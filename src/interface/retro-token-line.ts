// The Retro outcome's token row. Qualified rather than plain `token-line.ts` because two more of these
// live in this directory (batch-token-line.ts, reviewer-token-line.ts) with different labels; see the
// note in batch-token-line.ts for why they are three functions and not one.

import type { RetroResult } from '../core/session/index.js';
import { theme } from '../core/ui/theme.js';

/** Exact token line — never a length estimate; says "not reported" when a metric was omitted. */
export function retroTokenLine(result: RetroResult): string {
  const prompt = result.tokens.promptTokens === null ? 'not reported' : String(result.tokens.promptTokens);
  const evalT = result.tokens.evalTokens === null ? 'not reported' : String(result.tokens.evalTokens);
  return theme.meta(`Retro tokens — prompt: ${prompt}, eval: ${evalT}`);
}
