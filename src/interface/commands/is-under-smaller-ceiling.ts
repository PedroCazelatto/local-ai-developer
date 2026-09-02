// Whether a context predates a RAISE of OLLAMA_NUM_CTX. Split out of resume.ts, where the listing and
// the post-restore warning both asked the question and had to agree on the answer.

import type { ContextSummary } from '../../core/session/index.js';

/**
 * Whether this context predates a RAISE of OLLAMA_NUM_CTX — it was written to fit a smaller window than
 * the session now runs. The other direction cannot appear here: a context written under a larger ceiling
 * is filtered out of the query entirely (memory-db.listContexts), which is the safety half of the rule.
 */
export function isUnderSmallerCeiling(context: ContextSummary, sessionNumCtx: number): boolean {
  return context.numCtx < sessionNumCtx;
}
