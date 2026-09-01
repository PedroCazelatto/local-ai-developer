// Spawn a fresh Reviewer window, run it to a verdict, and return the outcome. The window is discarded
// when this resolves -- the calling phase pays context for the VERDICT alone, never for the review.

import type { ReviewerDeps } from './reviewer-deps.type.js';
import type { ReviewerInput } from './reviewer-input.type.js';
import type { ReviewerOutcome } from './reviewer-outcome.type.js';
import { PHASE_SCOPED_TOOL_NAMES, REVIEWER_TOOL_NAMES, resolvePhaseTools } from '../../phases/index.js';
import { REVIEWER_MAX_ROUNDS } from './reviewer-window.js';
import { ReviewerVerdictError } from './reviewer-verdict-error.js';
import { ReviewerWindow } from './reviewer-window.js';
import { SUBMIT_VERDICT, parseVerdict } from '../../tools/submit-verdict.js';
import { buildReviewerSeed } from './build-reviewer-seed.js';
import { buildSystemPrompt, loadPhasePrompt } from '../../context/index.js';
import { processMessage } from './process-message.js';

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
