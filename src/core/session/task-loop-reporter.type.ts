// The progress seam runTaskLoop reports through — one unowned type, in its own file because nothing
// owns it. Four declarations take a TaskLoopReporter and none of them produces one: runTaskLoop
// (run-task-loop.ts), SessionOrchestrator.runTaskLoop, RunOrchestrator.runTaskLoop
// (interface/commands/run-orchestrator.type.ts) and the same method on run-repl.ts's own interface —
// the last three all restatements of the first, for dependency inversion. The one producer is
// interface/commands/build-task-loop-reporter.ts, and folding it there would make core/session import
// a type out of src/interface: a direction no file in core/session has, and the inversion that kept
// ToolDiffDisplay out of build-file-diff.ts. It is the interface depended UPON, which is what lets the
// loop be driven with no renderer at all — the same reading that put KeypressSource in its own file,
// and the shape batch-reporter.type.ts already takes beside runBatch.

import type { TokenCounts } from '../llm/token-counts.type.js';
import type { ReviewVerdict } from './review-verdict.type.js';

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
