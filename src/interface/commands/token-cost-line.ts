// The exact per-task loop cost, as /run reports it after every outcome. Split out of run.ts.
//
// It says `not reported` for a metric Ollama omitted rather than printing 0 or a length-based
// estimate — the constitution's exact-token invariant: a missing metric is surfaced, never guessed at.

import type { TokenCounts } from '../../core/llm/index.js';

/** Exact loop-cost line — never a length estimate; says "not reported" when a metric was omitted. */
export function tokenCostLine(tokens: TokenCounts): string {
  const prompt = tokens.promptTokens === null ? 'not reported' : String(tokens.promptTokens);
  const evalT = tokens.evalTokens === null ? 'not reported' : String(tokens.evalTokens);
  return `loop cost — prompt ${prompt}, completion ${evalT} tokens (exact, summed over all rounds)`;
}
