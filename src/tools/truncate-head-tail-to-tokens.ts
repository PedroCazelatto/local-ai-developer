// The token-budget twin of truncate.ts's truncateHeadTail: keep a head and a tail, drop the middle, and
// say how much went. It exists because the model-facing budgets are now TOKENS derived from the one
// ceiling (budget-fractions.ts) while the shell tools' output caps are still characters (backlog item
// 42) — two units, so two functions, rather than one function a caller could hand the wrong unit.
//
// The marker sits ON TOP of the budget, exactly as it does in the character version: head + tail fit
// `maxTokens`, and the one marker line is extra. Its count carries a `~` because it is an estimate
// (estimate-tokens.ts), and the model must not be told an approximation as if it were Ollama's figure.

import { charsWithinTokens } from '../core/llm/chars-within-tokens.js';
import { estimateTokens } from '../core/llm/estimate-tokens.js';

/**
 * `text` unchanged when its estimate fits `maxTokens`; otherwise its first and last halves of the budget
 * with a marker naming the estimated tokens dropped between them.
 */
export function truncateHeadTailToTokens(text: string, maxTokens: number): string {
  if (estimateTokens(text) <= maxTokens) return text;
  // charsWithinTokens: the most characters half the budget admits — the cut point on each side.
  const half = charsWithinTokens(Math.floor(maxTokens / 2));
  const head = text.slice(0, half);
  const tail = text.slice(text.length - half);
  const omitted = estimateTokens(text.slice(half, text.length - half));
  return `${head}\n...[truncated ~${omitted} tokens]...\n${tail}`;
}
