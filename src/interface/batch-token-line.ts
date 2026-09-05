// The batch summary's token row. One of three near-identical `tokenLine` helpers the sweep found in this
// directory — the other two are retro-token-line.ts and reviewer-token-line.ts — and all three are
// qualified rather than sharing the plain name: each prints a different label, and this one alone says
// `completion` where the others say `eval`. Deliberately NOT merged behind a label parameter; they were
// never one function.

import type { BatchSummary } from '../core/session/batch-summary.type.js';
import { theme } from '../core/ui/theme.js';

/** Exact token line — never a length estimate; says "not reported" when a metric was omitted (constitution). */
export function batchTokenLine(summary: BatchSummary): string {
  const prompt = summary.tokens.promptTokens === null ? 'not reported' : String(summary.tokens.promptTokens);
  const evalT = summary.tokens.evalTokens === null ? 'not reported' : String(summary.tokens.evalTokens);
  return theme.meta(`Tokens (exact, summed over every task's loop) — prompt: ${prompt}, completion: ${evalT}`);
}
