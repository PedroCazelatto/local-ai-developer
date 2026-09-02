// One Reviewer window (V2/01): its own TurnContext over its own messages array, isolated from the
// session's per-phase histories and from the Worker whose attempt it is judging.
//
// It is the phase that COMMITS. A verdict is checked against the real repo before it is accepted, so
// a "pass" that left files uncommitted, or a "fail" that left a file unexplained, is handed back as a
// recoverable error rather than believed.

import type { FileReadTracker } from './file-read-tracker.type.js';
import type { OllamaClient, Message, StreamHandle, TokenCounts, Tool, ToolCall } from '../llm/index.js';
import type { RaisedBlocker } from './raised-blocker.type.js';
import type { ReviewVerdict } from './review-verdict.type.js';
import type { ReviewerCommit } from './reviewer-commit.type.js';
import type { ReviewerDeps } from './reviewer-deps.type.js';
import type { Task } from './task.type.js';
import type { ToolCallRecord } from './tool-call-record.type.js';
import type { TurnContext } from './turn-context.type.js';
import { BACKLOG_DIRNAME } from './backlog-root.js';
import { COMMIT_CHANGES } from '../../tools/commit-changes.js';
import { MARK_TASK_DONE } from '../../tools/mark-task-done.js';
import { PHASE_SCOPED_TOOL_NAMES, REVIEWER_TOOL_NAMES } from '../../phases/phase-tool-names.js';
import { resolvePhaseTools } from '../../phases/resolve-phase-tools.js';
import { RAISE_BLOCKER, validateBlockerRequest } from '../../tools/raise-blocker.js';
import { ReviewerVerdictError } from './reviewer-verdict-error.js';
import { SUBMIT_VERDICT, parseVerdict } from '../../tools/submit-verdict.js';
import { addTokenCounts } from './add-token-counts.js';
import { createReadTracker } from './read-tracker.js';
import { createToolContext } from '../../tools/create-tool-context.js';
import { dispatchToolCall } from './dispatch-tool-call.js';
import { listChangedPaths } from './list-changed-paths.js';
import { raiseBlocker } from './raise-blocker.js';
import { recordToolCall } from './record-tool-call.js';
import { setTaskStatus } from './set-task-status.js';
import { toolError } from '../../tools/tool-error.js';
import { verdictGitConflict } from './verdict-git-conflict.js';

// The Reviewer inspects (a few reads + maybe a test re-run) then submits — lighter than the Worker's
// test-first implement loop, but give headroom for reading several files before the verdict.
export const REVIEWER_MAX_ROUNDS = 16;

// Re-prompt ONCE on a malformed/inconsistent verdict, then give up and surface failure to the user.
export const MAX_VERDICT_ATTEMPTS = 2;

/**
 * The registry tools the Reviewer may dispatch — its array from phase-tool-names.ts minus the
 * phase-scoped exits this window answers itself (submit_verdict / raise_blocker / mark_task_done).
 * Used by callTool to decide what goes to the shared dispatcher; the definitions sent to the model
 * come from resolvePhaseTools('reviewer'), so both sides read the same one array.
 */
const REVIEWER_DISPATCHABLE: readonly string[] = REVIEWER_TOOL_NAMES.filter(
  (name) => !PHASE_SCOPED_TOOL_NAMES.includes(name),
);

/**
 * A single Reviewer window implementing the turn loop's TurnContext against its OWN messages array —
 * isolated from the session's per-phase histories and from the Worker. Read/inspect tool calls
 * dispatch through the shared registry (audited as phase "reviewer"); submit_verdict is captured
 * here directly (it is not a registry tool); any mutating tool is refused with a recoverable error.
 */
export class ReviewerWindow implements TurnContext {
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
  /**
   * This window's read tracker. The Reviewer has no write_file/edit_file, so nothing here is ever
   * guarded against — it is passed because ToolContext requires one, and requiring it is what stops a
   * window from silently opting out of the guard. Its reads stay its own either way.
   */
  private readonly readTracker: FileReadTracker = createReadTracker();
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
    return this.deps.llm.stream('reviewer', this.messages, this.reviewerTools);
  }

  streamContinue(): StreamHandle {
    return this.deps.llm.stream('reviewer', this.messages, this.reviewerTools);
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
        readTracker: this.readTracker, // this window's own (the Reviewer cannot write, so never gated)
      });
      const result = await dispatchToolCall(ctx, name, args, {
        onToolCall: (record) => recordToolCall(this.deps.projectPath, record),
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
    this.audit(MARK_TASK_DONE, args, 0, output, null, start, `${this.task.id} marked done`);
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
      const issues = parsed.verdict.issues.length;
      const output = `Verdict recorded: ${parsed.verdict.result} — ${issues} issue(s).`;
      this.audit(SUBMIT_VERDICT, args, 0, output, null, start, `${parsed.verdict.result} · ${issues} issue${issues === 1 ? '' : 's'}`);
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
    this.audit(RAISE_BLOCKER, args, 0, output, null, start, `blocker ${raised.id} raised — the loop halts here`);
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

  /**
   * Record one call this window handles directly (the three phase-scoped exits, or a refusal): its
   * audit row AND its `←` line. These never reach the shared dispatcher, so without this they would be
   * the calls with no result line at all — and a refused write tool is precisely the case the record
   * exists for. `summary` is the tool's own words; omitted, the line falls back to `error`.
   */
  private audit(
    tool: string,
    args: Record<string, unknown>,
    exitStatus: number,
    output: string,
    error: string | null,
    startedAt: number,
    summary?: string,
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
      ...(summary !== undefined ? { display: { summary } } : {}),
    };
    recordToolCall(this.deps.projectPath, record);
  }
}
