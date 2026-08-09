// Types for the V3/05 unattended batch driver (sibling of batch.ts; constitution: types live beside the
// function they serve). The BatchSummary is the "morning-after report": one batch's per-task outcomes and
// its EXACT total token spend. Tokens are the codebase's nullable TokenCounts (not the task file's
// illustrative { prompt, completion }) — the constitution's "surface a missing count, never estimate"
// invariant governs, so a null promptTokens/evalTokens propagates instead of being coerced to a number.

import type { TokenCounts } from '../llm/index.js';
import type { RunStopSignal } from './run-stop-signal.js';
import type { TaskLoopResult } from './run-task-loop.type.js';
import type { Task } from './types.js';

/** A task that passed review — the Reviewer committed every file and marked it done. */
export interface BatchPassed {
  readonly taskId: string;
  /** Short SHAs the Reviewer landed, oldest first; empty if git reported none. */
  readonly commits: readonly string[];
  readonly rounds: number;
}

/**
 * A task that failed every round; its remaining attempt stashed for the user to inspect. NOT
 * necessarily uncommitted: the Reviewer commits partially, so earlier rounds may have accepted some
 * files — `commits` is what landed before the loop ran out of rounds.
 */
export interface BatchEscalated {
  readonly taskId: string;
  readonly rounds: number;
  readonly lastFeedback: string;
  /** Short SHAs the Reviewer accepted along the way, oldest first; empty when nothing landed. */
  readonly commits: readonly string[];
  /** Stable `git stash` label of the preserved attempt, or null if there was nothing to stash. */
  readonly stashRef: string | null;
}

/** A task the Reviewer raised a blocker on — queued for /answer; its attempt stashed for Retro to read. */
export interface BatchBlocked {
  readonly taskId: string;
  readonly blockerId: string | null;
  readonly question: string;
  /** Short SHAs the Reviewer had already accepted before it halted; empty when nothing landed. */
  readonly commits: readonly string[];
  /** Stable `git stash` label of the attempt Retro will inspect, or null if there was nothing to stash. */
  readonly stashRef: string | null;
}

/** A task skipped before running (already done, blocked awaiting an answer, or unmet dependencies). */
export interface BatchSkipped {
  readonly taskId: string;
  readonly reason: string;
}

/**
 * A task the user interrupted — Ctrl+C cut the model call, or a `/stop round` ended the loop between
 * rounds. Its own bucket rather than an escalation, because nothing judged it: the distinction is what
 * stops a wound-down overnight run from reading, the next morning, as five tasks that failed review.
 * Like every other non-pass it stashes what was left and may still carry commits an earlier round landed.
 */
export interface BatchCancelled {
  readonly taskId: string;
  readonly rounds: number;
  /** One line on how it was stopped, from the loop that stopped. */
  readonly reason: string;
  /** Short SHAs the Reviewer accepted before the interruption; empty when nothing landed. */
  readonly commits: readonly string[];
  /** Stable `git stash` label of the preserved attempt, or null if there was nothing to stash. */
  readonly stashRef: string | null;
}

/** One unattended batch's persisted outcome — written under .orchestrator/batches/ for the morning after. */
export interface BatchSummary {
  /** Sequential batch number (also the persisted file-name prefix). */
  readonly seq: number;
  readonly startedAt: string; // UTC ISO
  readonly finishedAt: string; // UTC ISO
  /** Tasks actually run through the loop this batch (passed + escalated + blocked). */
  readonly total: number;
  readonly passed: BatchPassed[];
  readonly escalated: BatchEscalated[];
  readonly blocked: BatchBlocked[];
  readonly cancelled: BatchCancelled[];
  readonly skipped: BatchSkipped[];
  /** EXACT sum of every task's loop tokens (a null field means some turn omitted it — never estimated). */
  readonly tokens: TokenCounts;
  /** Present only when a pre-flight refusal or an infra fault stopped the batch early. */
  readonly abortedReason?: string;
  /**
   * Present only when the USER wound the batch down (`/stop`, `/stop round`, or Ctrl+C). Separate from
   * `abortedReason`, which means the batch broke: a deliberate stop is not a fault and must not be
   * reported as one, and the tasks it had already finished are all still in their own buckets.
   */
  readonly stoppedReason?: string;
}

/** Position of a task within the batch's candidate list, for the `task N/M` progress line. */
export interface BatchPosition {
  /** 1-based position among the selected candidate ids. */
  readonly index: number;
  /** Total selected candidate ids (some may end up skipped). */
  readonly total: number;
}

/**
 * What the batch driver binds to: the project root + the seam that runs ONE task's loop. The seam is
 * supplied by the interface layer (it wraps orch.runTaskLoop with the Worker spec slice + a per-task
 * reporter), so the core driver never imports a concrete renderer (dependency inversion).
 */
export interface BatchDeps {
  readonly projectPath: string;
  // runTask: run ONE eligible task through the V3/01 implement→test→review→fix loop; the Reviewer commits.
  runTask(task: Task, position: BatchPosition): Promise<TaskLoopResult>;
  /** The `/stop` wind-down request, read between tasks. See run-stop-signal.ts. */
  readonly stop: RunStopSignal;
}

/** UI seam the batch reports progress through (the interface supplies the rendering). */
export interface BatchReporter {
  /** A task is about to run (its position among the candidates). */
  taskStarted(position: BatchPosition, task: Task): void;
  /** A candidate was skipped before running, with why. */
  taskSkipped(taskId: string, reason: string): void;
  /** One task's terminal loop outcome (passed / escalated / blocked). */
  taskOutcome(result: TaskLoopResult): void;
  /** The batch finished (or aborted) — render the end-of-batch summary table. */
  finished(summary: BatchSummary): void;
}
