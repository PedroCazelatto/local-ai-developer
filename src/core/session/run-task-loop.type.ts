// Types for the V3/01 implement→test→review→fix controller (sibling of run-task-loop.ts). Kept
// beside the function they serve (constitution: types live in a sibling file, never inline).

import type { SandboxClient } from '../container/index.js';
import type { OllamaClient, TokenCounts } from '../llm/index.js';
import type { ReviewVerdict } from './review-verdict.type.js';
import type { ReviewerCommit } from './reviewer-runner.js';
import type { RunStopSignal } from './run-stop-signal.js';

/**
 * How one task's loop ended:
 * - `passed`    — a Reviewer `pass`; everything was committed and the task marked done; loop over.
 * - `escalated` — MAX_ROUNDS elapsed with no pass (or the Worker changed nothing / the Reviewer
 *                 produced no verdict); surfaced to the user with the last feedback.
 * - `blocked`   — the Reviewer raised a blocker (V3/02); loop halted mid-round.
 * - `cancelled` — the user stopped it: Ctrl+C cut the model call in flight, or a `/stop round` wind-down
 *                 ended the loop between rounds. Distinct from `escalated` ON PURPOSE — the task was not
 *                 tried and found wanting, it was interrupted, and a summary that called it an escalation
 *                 would be reporting a judgement nobody made.
 *
 * `escalated`, `blocked` and `cancelled` none of them imply "nothing committed": the Reviewer commits
 * partially, so files it accepted in an earlier round are already in git. `commits` is what actually landed.
 */
export type TaskLoopOutcome = 'passed' | 'escalated' | 'blocked' | 'cancelled';

/** The session infrastructure the loop binds a Worker/Reviewer window to (supplied by the orchestrator). */
export interface TaskLoopDeps {
  readonly llm: OllamaClient;
  readonly sandbox: SandboxClient;
  readonly projectName: string;
  readonly projectPath: string;
  /**
   * From SessionConfig — the fraction of num_ctx at which the persistent Worker window starts stubbing
   * its older tool results (worker-runner.ts). Carried here because TaskLoopDeps is what the loop hands
   * straight to `new WorkerWindow(...)`, so WorkerDeps' own fields have to be satisfiable from it.
   */
  readonly evictionThresholdRatio: number;
  /** The `/stop` wind-down request, read between rounds. See run-stop-signal.ts. */
  readonly stop: RunStopSignal;
}

/** The single result the loop returns for one task. */
export interface TaskLoopResult {
  readonly taskId: string;
  readonly outcome: TaskLoopOutcome;
  /** Rounds actually run, 1..MAX_ROUNDS. */
  readonly rounds: number;
  /**
   * Every commit the Reviewer made across all rounds, in order — empty when it accepted nothing.
   * Present on EVERY outcome: partial acceptance means an escalated or blocked task can still have
   * landed work.
   */
  readonly commits: readonly ReviewerCommit[];
  /** The Reviewer's blocker question — present only when outcome === "blocked" (V3/02). */
  readonly question?: string;
  /** The persisted blocker id (`${taskId}#${n}`) — present only when outcome === "blocked" (V3/02). */
  readonly blockerId?: string;
  /** The last Reviewer feedback — present when outcome === "escalated", so a human sees why. */
  readonly lastFeedback?: string;
  /** How a `cancelled` loop was stopped, in one line — present only when outcome === "cancelled". */
  readonly cancelReason?: string;
  /**
   * EXACT sum of every Worker AND Reviewer turn's prompt/eval counts across all rounds. A field is
   * `null` when any contributing turn omitted that metric — surfaced, never estimated (constitution).
   */
  readonly tokens: TokenCounts;
}

/**
 * UI seam the loop reports progress through (dependency inversion: the core loop never imports a
 * concrete renderer). The interface layer supplies an implementation; a batch run (V3/05) can supply
 * a quiet one. `tokens` on a verdict is that Reviewer window's LAST-turn count (its context size),
 * distinct from TaskLoopResult.tokens (the whole-loop sum).
 */
export interface TaskLoopReporter {
  /** A new round is starting (`round` of `maxRounds`). */
  roundStarted(round: number, maxRounds: number): void;
  /** The Worker's changed-file set this round (porcelain `git status`), shown before review. */
  filesChanged(status: string): void;
  /** The Reviewer's structured verdict for this round, with its file count + exact last-turn tokens. */
  verdictReady(verdict: ReviewVerdict, changedCount: number, tokens: TokenCounts): void;
}
