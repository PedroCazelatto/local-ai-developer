// Sum two EXACT Ollama token readings into one running total (V3/01 fix-loop cost accounting).
// The whole point is keeping the counts exact: prompt/eval are summed field-by-field, and a `null`
// (Ollama did not report that metric on some turn) POISONS the sum to `null` rather than being
// treated as 0 — so a missing count is surfaced downstream, never papered over with a guess
// (constitution: token counts are always exact). Start an accumulator at { promptTokens: 0,
// evalTokens: 0 } and fold each turn's counts through this.

import type { TokenCounts } from '../llm/index.js';

/** Combine two token readings into their exact field-wise sum; either `null` ⇒ that field is `null`. */
export function addTokenCounts(a: TokenCounts, b: TokenCounts): TokenCounts {
  return {
    // A missing metric on EITHER side ("not reported") wins over a numeric partial — never 0-coerced.
    promptTokens: a.promptTokens === null || b.promptTokens === null ? null : a.promptTokens + b.promptTokens,
    evalTokens: a.evalTokens === null || b.evalTokens === null ? null : a.evalTokens + b.evalTokens,
  };
}
