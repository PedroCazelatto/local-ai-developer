// Reviewer runner (V2/01) — spawns a FRESH, ISOLATED Reviewer window to judge ONE Worker attempt.
// Mirrors worker-runner.ts: an empty messages array seeded with the Reviewer system prompt
// (rules/phases/reviewer.md via loadPhasePrompt) + a user message carrying the task, the Worker's
// change summary, the changed files, and the test results. It runs the SAME tool-dispatch loop, but
// with a READ-MOSTLY tool allowlist (no write_file/edit_file/commit) PLUS the phase-scoped
// submit_verdict tool. When the Reviewer calls submit_verdict, the window captures + validates the
// ReviewVerdict, ends the turn (via TurnContext.isComplete), and is DISCARDED.
//
// Isolation is the whole point: the window never sees the Worker's history, so it cannot rationalize
// the Worker's own work (CLAUDE.md, Memory model — the Reviewer is a separate fresh window).
//
// Scope (V2/01): ONE spawn, ONE verdict. No fix loop, no raise_blocker, no Retro, no inbox — those
// are V3. The parsed ReviewVerdict is the ONLY contract; V2/02 wires this after the Worker and
// surfaces the verdict + exact tokens.

import { buildSystemPrompt, loadPhasePrompt } from '../../context/index.js';
import { createToolContext } from '../../tools/index.js';
import { toolError } from '../../tools/index.js';
import { RAISE_BLOCKER, raiseBlockerTool, validateBlockerRequest } from '../../tools/raise-blocker.js';
import { SUBMIT_VERDICT, parseVerdict, submitVerdictTool } from '../../tools/submit-verdict.js';
import type { SandboxClient } from '../container/index.js';
import type { OllamaClient, Message, StreamHandle, TokenCounts, Tool, ToolCall } from '../llm/index.js';
import { addTokenCounts } from './add-token-counts.js';
import { appendAuditRow } from './audit.js';
import { raiseBlocker } from './blocker-store.js';
import type { RaisedBlocker } from './blocker-store.type.js';
import type { ToolCallRecord } from './dispatch.js';
import { dispatchToolCall } from './dispatch.js';
import type { ReviewVerdict } from './review-types.js';
import { processMessage } from './turn-loop.js';
import type { TurnContext } from './turn-loop.js';
import type { Task } from './types.js';

// The Reviewer inspects (a few reads + maybe a test re-run) then submits — lighter than the Worker's
// test-first implement loop, but give headroom for reading several files before the verdict.
const REVIEWER_MAX_ROUNDS = 16;

// Re-prompt ONCE on a malformed/inconsistent verdict, then give up and surface failure to the user.
const MAX_VERDICT_ATTEMPTS = 2;

/**
 * The Reviewer's read-mostly tool allowlist. It judges — it never mutates or commits, so it gets no
 * write_file/edit_file/commit tool. execute_command is read-mostly by nature (root sandbox at
 * /workspace) and allowed for inspection; the prompt steers it toward reads, not mutation.
 * search_rules/load_rule are a V4 capability and simply absent here. The cross-phase inbox tools
 * (V3/04) are the one deliberate write channel: the Reviewer already signalled other phases via the
 * shared channel (was AGENT_NOTES.md) — the inbox is its structured replacement.
 */
export const REVIEWER_TOOL_NAMES: readonly string[] = [
  'read_file',
  'search_in_files',
  'list_files',
  'run_in_project',
  'execute_command',
  'inbox_read',
  'inbox_post',
  'inbox_resolve',
];

export interface ReviewerDeps {
  readonly llm: OllamaClient;
  /** The full registry tool set (toolDefinitions()); filtered here to read-mostly + submit_verdict. */
  readonly tools: Tool[];
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

  constructor(
    private readonly deps: ReviewerDeps,
    systemPrompt: string,
    /** The task under review + the round — stamped onto a raised blocker's durable record (V3/02). */
    private readonly task: Task,
    private readonly round: number,
  ) {
    this.messages = [{ role: 'system', content: systemPrompt }];
    const allowed = deps.tools.filter((tool) => {
      const name = tool.function.name;
      return name !== undefined && REVIEWER_TOOL_NAMES.includes(name);
    });
    // submit_verdict (the normal exit) + raise_blocker (the halt exit) are BOTH phase-scoped here and
    // never in the global registry — so the Worker's tool list can't contain either.
    this.reviewerTools = [...allowed, submitVerdictTool, raiseBlockerTool];
  }

  /** The validated verdict, or null if the Reviewer never produced a usable one. */
  get result(): ReviewVerdict | null {
    return this.verdict;
  }

  /** The blocker the Reviewer raised (V3/02), or null if it judged normally. */
  get blocker(): RaisedBlocker | null {
    return this.blockerRaised;
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
    if (REVIEWER_TOOL_NAMES.includes(name)) {
      const ctx = createToolContext({
        projectName: this.deps.projectName,
        projectPath: this.deps.projectPath,
        sandbox: this.deps.sandbox,
        phase: 'reviewer',
      });
      return dispatchToolCall(ctx, name, args, {
        onToolCall: (record) => appendAuditRow(this.deps.projectPath, record),
      });
    }
    // A mutating / commit / unknown tool — refuse (recoverable + audited). The Reviewer judges; it
    // does not modify or commit, so these are never wired into its tool list in the first place.
    return this.refuse(name, args);
  }

  /** Validate the submit_verdict payload; capture on success, re-prompt once, then give up. */
  private captureVerdict(args: Record<string, unknown>): string {
    const start = performance.now();
    const parsed = parseVerdict(args);
    if (parsed.ok) {
      this.verdict = parsed.verdict;
      const output = `Verdict recorded: ${parsed.verdict.result} — ${parsed.verdict.issues.length} issue(s).`;
      this.audit(SUBMIT_VERDICT, args, 0, output, null, start);
      return output;
    }

    this.verdictAttempts += 1;
    if (this.verdictAttempts >= MAX_VERDICT_ATTEMPTS) {
      // Re-prompt already spent — surface failure to the user (V2/02 catches ReviewerVerdictError).
      this.failure = parsed.error;
      const output = `Verdict rejected again: ${parsed.error}`;
      this.audit(SUBMIT_VERDICT, args, -1, output, parsed.error, start);
      return output;
    }
    // First invalid verdict → recoverable error so the model fixes the fields and re-submits once.
    const err = toolError(
      `Invalid verdict: ${parsed.error}`,
      'Fix the fields and call submit_verdict again with a valid, consistent verdict.',
    );
    const output = typeof err.content === 'string' ? err.content : JSON.stringify(err.content);
    this.audit(SUBMIT_VERDICT, args, err.exitStatus ?? -1, output, err.error ?? parsed.error, start);
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
      `tool '${name}' is not available to the Reviewer in this phase — it judges (read-only); it does not modify or commit.`,
      `Inspect with read_file / search_in_files / list_files / run_in_project / execute_command, then call ${SUBMIT_VERDICT}.`,
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
    : ' — not captured; inspect the working tree yourself with list_files / read_file / execute_command (git).';
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
- You have READ/INSPECT tools only (read_file, search_in_files, list_files, run_in_project, execute_command). You cannot edit or commit — you judge.
- When done, call ${SUBMIT_VERDICT} EXACTLY ONCE. result "pass" only if BOTH axes pass; any blocker/major issue means "fail"; every issue must be concrete and name the offending file + fix direction. Do not call any tool after ${SUBMIT_VERDICT}.
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
    return { blocker, tokens: window.tokens, tokensTotal: window.tokensTotal };
  }

  const verdict = window.result;
  if (verdict === null) {
    throw new ReviewerVerdictError(
      window.failureReason ??
        `The Reviewer ended after ${REVIEWER_MAX_ROUNDS} rounds without calling ${SUBMIT_VERDICT} with a valid verdict.`,
    );
  }
  return { verdict, tokens: window.tokens, tokensTotal: window.tokensTotal };
}
