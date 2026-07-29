// Reviewer runner (V2/01) — spawns a FRESH, ISOLATED Reviewer window to judge ONE Worker attempt.
// Mirrors worker-runner.ts: an empty messages array seeded with the Reviewer system prompt
// (rules/phases/reviewer.md via loadPhasePrompt) + a user message carrying the task, the Worker's
// change summary, the changed files, and the test results. It runs the SAME tool-dispatch loop, but
// with a READ-MOSTLY tool allowlist (no write_file/edit_file) PLUS the phase-scoped submit_verdict,
// mark_task_done and raise_blocker tools. When the Reviewer calls submit_verdict, the window captures
// + validates the ReviewVerdict, ends the turn (via TurnContext.isComplete), and is DISCARDED.
//
// The Reviewer is the ONLY execution phase that commits. It may commit PARTIALLY — accept some of the
// Worker's files and leave the rest — and every file it leaves goes back to the Worker with an issue
// explaining why (enforced by verdictGitConflict, not merely asked for in the prompt). Its verdict is
// therefore checked against the real repo state before it is accepted: a "pass" must leave a clean
// tree and a task marked done; a "fail" must explain every file still sitting in the working tree.
//
// Isolation is the whole point: the window never sees the Worker's history, so it cannot rationalize
// the Worker's own work (CLAUDE.md, Memory model — the Reviewer is a separate fresh window).
//
// Scope (V2/01): ONE spawn, ONE verdict. No fix loop, no raise_blocker, no Retro, no inbox — those
// are V3. The parsed ReviewVerdict is the ONLY contract; V2/02 wires this after the Worker and
// surfaces the verdict + exact tokens.

import { buildSystemPrompt, loadPhasePrompt } from '../../context/index.js';
import { PHASE_SCOPED_TOOL_NAMES, REVIEWER_TOOL_NAMES, resolvePhaseTools } from '../../phases/index.js';
import { createToolContext } from '../../tools/index.js';
import { toolError } from '../../tools/index.js';
import { COMMIT_CHANGES } from '../../tools/commit-changes.js';
import { LIST_CHANGES } from '../../tools/list-changes.js';
import { MARK_TASK_DONE } from '../../tools/mark-task-done.js';
import { RAISE_BLOCKER, validateBlockerRequest } from '../../tools/raise-blocker.js';
import { SUBMIT_VERDICT, parseVerdict } from '../../tools/submit-verdict.js';
import type { SandboxClient } from '../container/index.js';
import type { OllamaClient, Message, StreamHandle, TokenCounts, Tool, ToolCall } from '../llm/index.js';
import { addTokenCounts } from './add-token-counts.js';
import { appendAuditRow } from './audit.js';
import { BACKLOG_DIRNAME, setTaskStatus } from './backlog.js';
import { raiseBlocker } from './blocker-store.js';
import type { RaisedBlocker } from './blocker-store.type.js';
import type { ToolCallRecord } from './dispatch.js';
import { dispatchToolCall } from './dispatch.js';
import { listChangedPaths } from './project-git.js';
import type { ReviewVerdict } from './review-types.js';
import { processMessage } from './turn-loop.js';
import type { TurnContext } from './turn-loop.js';
import type { Task } from './types.js';
import { verdictGitConflict } from './verdict-git-conflict.js';

// The Reviewer inspects (a few reads + maybe a test re-run) then submits — lighter than the Worker's
// test-first implement loop, but give headroom for reading several files before the verdict.
const REVIEWER_MAX_ROUNDS = 16;

// Re-prompt ONCE on a malformed/inconsistent verdict, then give up and surface failure to the user.
const MAX_VERDICT_ATTEMPTS = 2;

/**
 * The registry tools the Reviewer may dispatch — its array from phase-tool-names.ts minus the
 * phase-scoped exits this window answers itself (submit_verdict / raise_blocker / mark_task_done).
 * Used by callTool to decide what goes to the shared dispatcher; the definitions sent to the model
 * come from resolvePhaseTools('reviewer'), so both sides read the same one array.
 */
const REVIEWER_DISPATCHABLE: readonly string[] = REVIEWER_TOOL_NAMES.filter(
  (name) => !PHASE_SCOPED_TOOL_NAMES.includes(name),
);

export interface ReviewerDeps {
  readonly llm: OllamaClient;
  readonly sandbox: SandboxClient;
  readonly projectName: string;
  readonly projectPath: string;
}

/** What the Reviewer window is told about the Worker's attempt (assembled by V2/02). */
export interface ReviewerInput {
  /** The task under review — same definition + acceptance the Worker was seeded with. */
  readonly task: Task;
  /** The fix-loop round (1..MAX_ROUNDS) being reviewed — stamped onto a raised blocker (V3/02). */
  readonly round: number;
  /** The Worker's plain-text change summary (its final no-tool turn). */
  readonly workerSummary: string;
  /** Changed-files set / diff for the attempt; "" if not captured (Reviewer inspects the tree itself). */
  readonly changedFiles: string;
  /** The test output the Worker produced (stdout/stderr + exit); "" if not captured (Reviewer re-runs). */
  readonly testResults: string;
}

/**
 * The Reviewer's result: EXACTLY ONE of `verdict` (it judged) or `blocker` (it raised a blocker
 * instead), plus exact tokens (last turn AND the whole-window sum). The V3/01 loop short-circuits to
 * `blocked` when `blocker` is present, otherwise acts on the verdict.
 */
export interface ReviewerOutcome {
  /** The validated verdict — present unless the Reviewer raised a blocker (V3/02) instead. */
  readonly verdict?: ReviewVerdict;
  /** Exact tokens from the Reviewer's FINAL turn (its context size) — the status-line / per-round figure. */
  readonly tokens: TokenCounts;
  /** Exact SUM across every turn of this Reviewer window — what the V3/01 loop folds into its total. */
  readonly tokensTotal: TokenCounts;
  /** Present INSTEAD of a verdict when the Reviewer raised a blocker (V3/02); already persisted. */
  readonly blocker?: RaisedBlocker;
  /**
   * Commits this Reviewer made, in order. A `pass` commits everything; a `fail` may still have
   * committed the files it accepted (partial acceptance), so these survive the round either way.
   */
  readonly commits: readonly ReviewerCommit[];
}

/** One commit the Reviewer made during this review — recorded as it happens, for the UI and the Worker. */
export interface ReviewerCommit {
  /** Short SHA, or null when git reported none. */
  readonly sha: string | null;
  /** Project-relative paths in that commit. */
  readonly files: readonly string[];
}

/** The Reviewer ended without a usable verdict (never submitted, or malformed past the re-prompt). */
export class ReviewerVerdictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReviewerVerdictError';
  }
}

/**
 * A single Reviewer window implementing the turn loop's TurnContext against its OWN messages array —
 * isolated from the session's per-phase histories and from the Worker. Read/inspect tool calls
 * dispatch through the shared registry (audited as phase "reviewer"); submit_verdict is captured
 * here directly (it is not a registry tool); any mutating tool is refused with a recoverable error.
 */
class ReviewerWindow implements TurnContext {
  readonly activePhase = 'reviewer';
  readonly messages: Message[];

  /** The read-mostly tool subset + submit_verdict, sent to the model on every turn. */
  private readonly reviewerTools: Tool[];
  /** Exact token counts from the most recent Reviewer turn (nulls preserved — never estimated). */
  private lastTokens: TokenCounts = { promptTokens: null, evalTokens: null };
  /** Running EXACT sum across every turn of this window (a null metric poisons the sum). */
  private tokenSum: TokenCounts = { promptTokens: 0, evalTokens: 0 };
  /** The captured, validated verdict — null until submit_verdict succeeds. */
  private verdict: ReviewVerdict | null = null;
  /** The captured blocker — null until raise_blocker succeeds; set INSTEAD of a verdict (V3/02). */
  private blockerRaised: RaisedBlocker | null = null;
  /** Non-null once we give up after the re-prompt (holds the last rejection reason). */
  private failure: string | null = null;
  /** How many times submit_verdict was called with an invalid payload. */
  private verdictAttempts = 0;
  /** Commits this Reviewer made, in order — captured from each successful commit_changes call. */
  private readonly commitsMade: ReviewerCommit[] = [];
  /** True once mark_task_done flipped the task under review to `done`; required before a `pass`. */
  private taskMarkedDone = false;

  constructor(
    private readonly deps: ReviewerDeps,
    systemPrompt: string,
    /** The task under review + the round — stamped onto a raised blocker's durable record (V3/02). */
    private readonly task: Task,
    private readonly round: number,
  ) {
    this.messages = [{ role: 'system', content: systemPrompt }];
    // One array covers both halves: the read-mostly registry tools AND the three phase-scoped exits —
    // submit_verdict (the normal exit), raise_blocker (the halt exit), mark_task_done (closing the task
    // under review). Those three are never in the global registry, so no other phase's list can hold them.
    this.reviewerTools = resolvePhaseTools('reviewer');
  }

  /** The validated verdict, or null if the Reviewer never produced a usable one. */
  get result(): ReviewVerdict | null {
    return this.verdict;
  }

  /** The blocker the Reviewer raised (V3/02), or null if it judged normally. */
  get blocker(): RaisedBlocker | null {
    return this.blockerRaised;
  }

  /** Every commit this Reviewer made, in order — kept even when the verdict is a fail (partial accept). */
  get commits(): readonly ReviewerCommit[] {
    return this.commitsMade;
  }

  /** Why the Reviewer failed to produce a verdict (set only on the give-up path). */
  get failureReason(): string | null {
    return this.failure;
  }

  /** Exact tokens from the Reviewer's final turn. */
  get tokens(): TokenCounts {
    return this.lastTokens;
  }

  /** Exact summed tokens across every turn this window ran (for the V3/01 whole-loop total). */
  get tokensTotal(): TokenCounts {
    return this.tokenSum;
  }

  streamAsk(userInput: string): StreamHandle {
    this.messages.push({ role: 'user', content: userInput });
    return this.deps.llm.stream(this.messages, this.reviewerTools);
  }

  streamContinue(): StreamHandle {
    return this.deps.llm.stream(this.messages, this.reviewerTools);
  }

  onTokens(tokens: TokenCounts): void {
    this.lastTokens = tokens;
    // Also accumulate across turns so the fix loop can sum the Reviewer's whole-window token cost.
    this.tokenSum = addTokenCounts(this.tokenSum, tokens);
  }

  addAssistant(content: string, toolCalls?: ToolCall[]): void {
    const entry: Message = { role: 'assistant', content };
    if (toolCalls && toolCalls.length > 0) {
      entry.tool_calls = toolCalls;
    }
    this.messages.push(entry);
  }

  addToolResult(toolName: string, result: string): void {
    this.messages.push({ role: 'tool', content: result, tool_name: toolName });
  }

  /** Terminal once a verdict OR a blocker is captured, or we gave up after the re-prompt — ends the loop. */
  isComplete(): boolean {
    return this.verdict !== null || this.blockerRaised !== null || this.failure !== null;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    if (name === SUBMIT_VERDICT) {
      return this.captureVerdict(args);
    }
    if (name === RAISE_BLOCKER) {
      return this.captureBlocker(args);
    }
    if (name === MARK_TASK_DONE) {
      return this.captureTaskDone(args);
    }
    if (REVIEWER_DISPATCHABLE.includes(name)) {
      const ctx = createToolContext({
        projectName: this.deps.projectName,
        projectPath: this.deps.projectPath,
        sandbox: this.deps.sandbox,
        phase: 'reviewer',
        llm: this.deps.llm, // backs ctx.oneShot for search_rules (V4/02) and the commit-message writer
      });
      const result = await dispatchToolCall(ctx, name, args, {
        onToolCall: (record) => appendAuditRow(this.deps.projectPath, record),
      });
      // Remember what this review actually landed, so the loop can report it and the next Worker turn
      // can be told which of its files were accepted. Read back from the tool's own result, not from
      // the arguments — the model's requested paths are not necessarily what git committed.
      if (name === COMMIT_CHANGES) this.recordCommit(result);
      return result;
    }
    // A file-writing / unknown tool — refuse (recoverable + audited). The Reviewer commits, but it
    // never edits: these are never wired into its tool list in the first place.
    return this.refuse(name, args);
  }

  /** Capture a successful commit_changes result; a failed or unparseable one records nothing. */
  private recordCommit(result: string): void {
    try {
      const parsed: unknown = JSON.parse(result);
      if (typeof parsed !== 'object' || parsed === null) return;
      const record = parsed as Record<string, unknown>;
      if (record['committed'] !== true) return;
      const files = Array.isArray(record['files']) ? record['files'].filter((f): f is string => typeof f === 'string') : [];
      this.commitsMade.push({ sha: typeof record['sha'] === 'string' ? record['sha'] : null, files });
    } catch {
      // The tool returned something other than JSON (only reachable if its contract changes) — the
      // commit itself still stands; we simply have nothing structured to report for it.
    }
  }

  /**
   * Flip the task under review to `status: done` in its backlog file (V2/03's setTaskStatus). The flip
   * is a working-tree edit, NOT a commit: the Reviewer must then commit the backlog file itself, and a
   * `pass` is refused while that file is still uncommitted — so a task can never be closed in the file
   * without the git history recording it. Idempotent; takes no arguments so it can only ever close the
   * task this window was handed.
   */
  private captureTaskDone(args: Record<string, unknown>): string {
    const start = performance.now();
    const backlogFile = `${BACKLOG_DIRNAME}/${this.task.id}.md`;
    try {
      setTaskStatus(this.deps.projectPath, this.task.id, 'done');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const output = JSON.stringify({ error: `could not mark '${this.task.id}' done: ${message}` });
      this.audit(MARK_TASK_DONE, args, -1, output, message, start);
      return output;
    }
    this.taskMarkedDone = true;
    const output = JSON.stringify({
      ok: true,
      task: this.task.id,
      status: 'done',
      commit_next: backlogFile,
      note: `Now commit ${backlogFile} with commit_changes, then submit your verdict.`,
    });
    this.audit(MARK_TASK_DONE, args, 0, output, null, start);
    return output;
  }

  /**
   * Validate the submit_verdict payload; capture on success, re-prompt once, then give up. Validation
   * has TWO layers: parseVerdict checks the payload's own shape/consistency, then verdictGitConflict
   * checks it against the real repo — a pass may not leave uncommitted work or an unclosed task, and a
   * fail must carry an issue for every file it is handing back. Both rejections ride the same single
   * re-prompt, so a confused Reviewer cannot spin here.
   */
  private captureVerdict(args: Record<string, unknown>): string {
    const start = performance.now();
    const parsed = parseVerdict(args);
    // listChangedPaths: what is STILL uncommitted after this Reviewer's own commits — the files it is
    // sending back to the Worker, by definition of having chosen not to commit them.
    const problem = parsed.ok
      ? verdictGitConflict({
          verdict: parsed.verdict,
          outstanding: listChangedPaths(this.deps.projectPath).files,
          taskMarkedDone: this.taskMarkedDone,
          taskId: this.task.id,
        })
      : parsed.error;

    if (parsed.ok && problem === null) {
      this.verdict = parsed.verdict;
      const output = `Verdict recorded: ${parsed.verdict.result} — ${parsed.verdict.issues.length} issue(s).`;
      this.audit(SUBMIT_VERDICT, args, 0, output, null, start);
      return output;
    }

    const reason = problem ?? 'invalid verdict.';
    this.verdictAttempts += 1;
    if (this.verdictAttempts >= MAX_VERDICT_ATTEMPTS) {
      // Re-prompt already spent — surface failure to the user (V2/02 catches ReviewerVerdictError).
      this.failure = reason;
      const output = `Verdict rejected again: ${reason}`;
      this.audit(SUBMIT_VERDICT, args, -1, output, reason, start);
      return output;
    }
    // First invalid verdict → recoverable error so the model fixes it and re-submits once.
    const err = toolError(
      `Invalid verdict: ${reason}`,
      'Fix it and call submit_verdict again — commit what you accept, and give an issue for every file you do not.',
    );
    const output = typeof err.content === 'string' ? err.content : JSON.stringify(err.content);
    this.audit(SUBMIT_VERDICT, args, err.exitStatus ?? -1, output, err.error ?? reason, start);
    return output;
  }

  /**
   * Capture a raise_blocker call (V3/02): gate it (Reviewer-only + non-empty question), and on
   * acceptance persist the durable `raised` row (blockers.jsonl) and set `blockerRaised` so the
   * window becomes terminal — the loop then halts as `blocked`, running no fix round and committing
   * nothing. An empty question is a RECOVERABLE structured error: the turn continues so the Reviewer
   * can re-call with a real question (it does NOT crash or halt).
   */
  private captureBlocker(args: Record<string, unknown>): string {
    const start = performance.now();
    const request = validateBlockerRequest(this.activePhase, args['question']);
    if (!request.ok) {
      const output = JSON.stringify({ ok: false, error: request.error, message: request.message });
      this.audit(RAISE_BLOCKER, args, -1, output, request.message, start);
      return output;
    }
    // Durable BEFORE we go terminal: the raised row must survive even if everything downstream fails.
    const raised = raiseBlocker(this.deps.projectPath, {
      taskId: this.task.id,
      round: this.round,
      question: request.question,
    });
    this.blockerRaised = raised;
    const output = JSON.stringify({
      ok: true,
      blocker: { id: raised.id, question: raised.question, raisedAt: raised.raisedAt },
    });
    this.audit(RAISE_BLOCKER, args, 0, output, null, start);
    return output;
  }

  /** Refuse a tool the Reviewer must not use, as a recoverable error the model can read and adapt to. */
  private refuse(name: string, args: Record<string, unknown>): string {
    const err = toolError(
      `tool '${name}' is not available to the Reviewer — it judges and commits, but it never edits the Worker's files.`,
      `Inspect with read_file / search_in_files / list_files / run_in_project / execute_command, commit what you ` +
        `accept with ${COMMIT_CHANGES}, then call ${SUBMIT_VERDICT} with an issue for every file you did not commit.`,
    );
    const output = typeof err.content === 'string' ? err.content : JSON.stringify(err.content);
    this.audit(name, args, err.exitStatus ?? -1, output, err.error ?? `tool '${name}' not available`, performance.now());
    return output;
  }

  /** Append one audit row for a call this window handles directly (submit_verdict / a refusal). */
  private audit(
    tool: string,
    args: Record<string, unknown>,
    exitStatus: number,
    output: string,
    error: string | null,
    startedAt: number,
  ): void {
    const record: ToolCallRecord = {
      ts: new Date().toISOString(),
      phase: 'reviewer',
      tool,
      args,
      exitStatus,
      durationMs: Math.round(performance.now() - startedAt),
      output,
      error,
    };
    appendAuditRow(this.deps.projectPath, record);
  }
}

/** Assemble the seed user message: the task + the Worker's summary/diff/test results + review orders. */
function buildReviewerSeed(input: ReviewerInput): string {
  const { task, workerSummary, changedFiles, testResults } = input;
  const changed = changedFiles.trim()
    ? `\n${changedFiles.trim()}`
    : ' — not captured; inspect the working tree yourself with list_changes / list_files / read_file.';
  const tests = testResults.trim()
    ? `\n${testResults.trim()}`
    : ' — not captured; re-run the tests yourself with run_in_project before deciding.';

  return `Review the Worker's attempt at ONE task. Judge it on BOTH axes — behavior (does it satisfy the task, including edge cases?) and standards (architecture, naming, testing conventions) — then submit ONE verdict.

## Task under review: ${task.title}
(backlog id: ${task.id})

${task.body}

## Worker's change summary
${workerSummary.trim() || '(the Worker left no summary)'}

## Changed files${changed}

## Test results the Worker reported${tests}

How to review:
- Do NOT trust the summary alone — read the changed files and the tests, and reason about correctness + edge cases.
- When in doubt, re-run the tests/build with run_in_project rather than trusting the transcript.
- You inspect with read_file, search_in_files, list_files, run_in_project and execute_command. You CANNOT edit files — the Worker does that.
- You are the one who commits. The Worker cannot commit anything, so nothing reaches the project history unless you put it there.

Committing this review:
- Call ${LIST_CHANGES} to see every uncommitted file, then ${COMMIT_CHANGES} to commit the ones you accept. You may commit PARTIALLY: take the files that are right and leave the rest.
- Keep each commit as small as it can be without breaking the project — commit one coherent change at a time, not the whole tree in one call.
- EVERY file you leave uncommitted goes back to the Worker, so every one of them needs an issue naming it and saying what to fix. A verdict that leaves a file unexplained is rejected.
- If the task is complete: call ${MARK_TASK_DONE}, commit the backlog file it changes, and make sure NOTHING is left uncommitted before you pass.

- When done, call ${SUBMIT_VERDICT} EXACTLY ONCE. result "pass" only if BOTH axes pass AND you committed everything AND the task is marked done; any blocker/major issue means "fail"; every issue must be concrete and name the offending file + fix direction. Do not call any tool after ${SUBMIT_VERDICT}.
- A "fail" with an empty working tree is fine and normal: it means everything the Worker wrote was good, but the task still needs work that does not exist yet. Say what is missing in your issues.
- If the TASK ITSELF is unjudgeable — ambiguous, under-specified, self-contradictory, or conflicting with the architecture — call ${RAISE_BLOCKER} with a precise question INSTEAD of a verdict, immediately. That is for a broken task, not for code that is merely wrong (a wrong-code case is a "fail" verdict with fix feedback).`;
}

/**
 * Spawn a fresh Reviewer window for one Worker attempt, run it to completion (streaming to the REPL,
 * all tool calls audited), and return the validated verdict + exact tokens. The window is discarded
 * when this resolves. Throws ReviewerVerdictError if the Reviewer never produced a usable verdict.
 */
export async function runReviewerTask(deps: ReviewerDeps, input: ReviewerInput): Promise<ReviewerOutcome> {
  const systemPrompt = buildSystemPrompt(loadPhasePrompt('reviewer'), `Project: ${deps.projectName}`);
  const window = new ReviewerWindow(deps, systemPrompt, input.task, input.round);
  await processMessage(window, buildReviewerSeed(input), REVIEWER_MAX_ROUNDS);

  // A raised blocker takes precedence over any verdict: the Reviewer halted because the TASK is the
  // problem, not the code. Return it INSTEAD of a verdict (already persisted) so the loop goes blocked.
  const blocker = window.blocker;
  if (blocker !== null) {
    // Any commit it made before halting still stands — a blocker is "this task is unjudgeable", not
    // "undo what was already accepted", and the orchestrator never rewrites history.
    return { blocker, tokens: window.tokens, tokensTotal: window.tokensTotal, commits: window.commits };
  }

  const verdict = window.result;
  if (verdict === null) {
    throw new ReviewerVerdictError(
      window.failureReason ??
        `The Reviewer ended after ${REVIEWER_MAX_ROUNDS} rounds without calling ${SUBMIT_VERDICT} with a valid verdict.`,
    );
  }
  return { verdict, tokens: window.tokens, tokensTotal: window.tokensTotal, commits: window.commits };
}
