// Spawn a fresh Reviewer window, run it to a verdict, and return the outcome. The window is discarded
// when this resolves -- the calling phase pays context for the VERDICT alone, never for the review.
//
// ReviewerOutcome is declared below, folded in from the retired reviewer-outcome.type.ts. It is part
// of the Reviewer window's contract with the orchestrator (V2/01), and it is a RESULT rather than a
// seam: the two `return` statements in this function are the only places in the tree a
// ReviewerOutcome is constructed, so the function that builds it owns it (constitution.md). The V3/01
// loop in run-task-loop.ts only READS one. Contrast ReviewerDeps beside it, which stays a standalone
// module precisely because the CALLER constructs that one.

import type { TokenCounts } from '../llm/index.js';
import type { RaisedBlocker } from './raised-blocker.type.js';
import type { ReviewVerdict } from './review-verdict.type.js';
import type { ReviewerCommit } from './reviewer-commit.type.js';
import type { ReviewerDeps } from './reviewer-deps.type.js';
import type { ReviewerInput } from './reviewer-input.type.js';
import { PHASE_SCOPED_TOOL_NAMES, REVIEWER_TOOL_NAMES } from '../../phases/phase-tool-names.js';
import { resolvePhaseTools } from '../../phases/resolve-phase-tools.js';
import { REVIEWER_MAX_ROUNDS } from './reviewer-window.js';
import { ReviewerVerdictError } from './reviewer-verdict-error.js';
import { ReviewerWindow } from './reviewer-window.js';
import { SUBMIT_VERDICT, parseVerdict } from '../../tools/submit-verdict.js';
import { buildReviewerSeed } from './build-reviewer-seed.js';
import { loadPhasePrompt } from '../../context/load-phase-prompt.js';
import { buildSystemPrompt } from '../../context/system-prompt.js';
import { processMessage } from './process-message.js';

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

/**
 * Spawn a fresh Reviewer window for one Worker attempt, run it to completion (streaming to the REPL,
 * all tool calls audited), and return the validated verdict + exact tokens. The window is discarded
 * when this resolves. Throws ReviewerVerdictError if the Reviewer never produced a usable verdict.
 */
export async function runReviewerTask(deps: ReviewerDeps, input: ReviewerInput): Promise<ReviewerOutcome> {
  // resolvePhaseTools is pure over a static registry, so this resolve and the window's own (which
  // feeds Ollama) return the same array — the prompt's "# Your Tools" list names submit_verdict,
  // raise_blocker and mark_task_done alongside the registry tools, exactly as the window sends them.
  const systemPrompt = buildSystemPrompt(
    loadPhasePrompt('reviewer'),
    resolvePhaseTools('reviewer'),
    `Project: ${deps.projectName}`,
  );
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
