// The Reviewer verdict's token row. Qualified rather than plain `token-line.ts` because two more of
// these live in this directory (batch-token-line.ts, retro-token-line.ts) with different labels; see the
// note in batch-token-line.ts for why they are three functions and not one.

import type { TokenCounts } from '../core/llm/token-counts.type.js';
import { theme } from '../core/ui/theme.js';

/** Exact token line — never a length estimate; says "not reported" when a metric was omitted. */
export function reviewerTokenLine(tokens: TokenCounts): string {
  const prompt = tokens.promptTokens === null ? 'not reported' : String(tokens.promptTokens);
  const evalT = tokens.evalTokens === null ? 'not reported' : String(tokens.evalTokens);
  return theme.meta(`Reviewer tokens — prompt: ${prompt}, eval: ${evalT}`);
}
