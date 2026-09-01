// Part of the Reviewer window's contract with the orchestrator (V2/01).

import type { OllamaClient, Message, StreamHandle, TokenCounts, Tool, ToolCall } from '../llm/index.js';
import type { RaisedBlocker } from './raised-blocker.type.js';
import type { ReviewVerdict } from './review-verdict.type.js';
import type { ReviewerCommit } from './reviewer-commit.type.js';

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
