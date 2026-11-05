// The inverse of estimate-tokens.ts: how much text a token budget admits, for the call sites that have
// to CUT text rather than merely measure it. Kept beside the estimator's ratio rather than re-derived at
// each cut, so the two directions cannot drift onto different ratios.

import { CHARS_PER_TOKEN } from './estimate-tokens.js';

/**
 * The most characters whose estimate fits within `tokens` — every length up to this one has
 * `estimateTokens(text) <= tokens`, and one more character would not.
 */
export function charsWithinTokens(tokens: number): number {
  return tokens * CHARS_PER_TOKEN;
}
