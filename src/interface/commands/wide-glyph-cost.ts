// The width correction write-fitted-line.ts applies before it cuts a row.
//
// It was private to that file until the one-function-per-file sweep; the name is unchanged because it
// already said what it measures rather than how it is used.

import { visibleWidth } from '../../core/ui/visible-width.js';

/**
 * The columns `text` costs BEYOND its character count — one per wide glyph (CJK, emoji, and symbols
 * like `⛔`, which the terminal draws two columns wide). truncateToWidth cuts by character count, so
 * a row carrying wide glyphs has to be given a smaller budget or it overflows the terminal and wraps,
 * which is the one thing a fitted row must never do.
 *
 * The correction is deliberately conservative: it is measured on the WHOLE string, so if the cut
 * removes some of those glyphs the budget was tighter than it strictly needed to be. Erring toward a
 * row that is a column short is right; erring toward one that wraps is not.
 */
export function wideGlyphCost(text: string): number {
  return Math.max(0, visibleWidth(text) - text.length);
}
