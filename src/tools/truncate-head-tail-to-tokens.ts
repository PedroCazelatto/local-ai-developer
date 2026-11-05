// The token-budget twin of truncate.ts's truncateHeadTail: keep a head and a tail, drop the middle, and
// say how much went. It exists because the model-facing budgets are now TOKENS derived from the one
// ceiling (budget-fractions.ts) while the shell tools' output caps are still characters (backlog item
// 42) — two units, so two functions, rather than one function a caller could hand the wrong unit.
//
// The marker sits ON TOP of the budget, exactly as it does in the character version: head + tail fit
// `maxTokens`, and the one marker line is extra. Its count carries a `~` because it is an estimate
// (estimate-tokens.ts), and the model must not be told an approximation as if it were Ollama's figure.
//
// It returns how many CHARACTERS it dropped alongside the text, because a caller that records the cut
// (debate's audit row) needs an exact figure, and only this function knows where it cut — re-deriving the
// cut points at a call site would be a second copy of them to drift.

import { charsWithinTokens } from '../core/llm/chars-within-tokens.js';
import { estimateTokens } from '../core/llm/estimate-tokens.js';

/** What a head+tail cut produced: the text to send, and how much was dropped from its middle. */
export interface HeadTailCut {
  readonly text: string;
  /** Characters dropped from the middle — exact, and 0 when the text fitted and came back unchanged. */
  readonly omittedChars: number;
}

/**
 * `text` unchanged when its estimate fits `maxTokens`; otherwise its first and last halves of the budget
 * with a marker naming the estimated tokens dropped between them.
 */
export function truncateHeadTailToTokens(text: string, maxTokens: number): HeadTailCut {
  if (estimateTokens(text) <= maxTokens) return { text, omittedChars: 0 };
  // charsWithinTokens: the most characters half the budget admits — the cut point on each side.
  const half = charsWithinTokens(Math.floor(maxTokens / 2));
  const head = text.slice(0, half);
  const middle = text.slice(half, text.length - half);
  const tail = text.slice(text.length - half);
  return {
    text: `${head}\n...[truncated ~${estimateTokens(middle)} tokens]...\n${tail}`,
    omittedChars: middle.length,
  };
}
