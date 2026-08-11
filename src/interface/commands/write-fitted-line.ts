// Print ONE row of an inspection command's output into the append-only scrollback, guaranteed to
// occupy exactly one terminal row.
//
// Two things can break that guarantee and both are handled here, in one place, so no caller has to
// remember them:
//   - an embedded newline (a blocker question, an inbox body, a Reviewer's feedback are all free
//     text the model wrote) — flattened with singleLine, so one logical row is one printed row;
//   - a line longer than the terminal — cut with truncateToWidth, the same width layer the question
//     panel measures its rows with.
// Truncate FIRST, style AFTER: truncateToWidth takes plain text by design, because measuring a styled
// string means counting around escape codes and a cut could land inside one and leak a half-sequence.
//
// Nothing here repaints: every line it writes is final the moment it lands (constitution, Terminal UX).

import { stdout } from 'node:process';

import { singleLine } from '../../core/ui/single-line.js';
import { terminalColumns } from '../../core/ui/terminal-columns.js';
import { truncateToWidth } from '../../core/ui/truncate-to-width.js';
import { visibleWidth } from '../../core/ui/visible-width.js';
import type { RowStyle } from './write-fitted-line.type.js';

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
function wideGlyphCost(text: string): number {
  return Math.max(0, visibleWidth(text) - text.length);
}

/**
 * Write `text` as one terminal row, cut to the terminal's width and painted with `style`. An empty
 * string is the block separator and is written bare — a blank row has no width to fit and no text to
 * color, and styling it would emit escape codes around nothing.
 */
export function writeFittedLine(text: string, style: RowStyle): void {
  if (text === '') {
    stdout.write('\n');
    return;
  }
  // singleLine: collapse every embedded line break (and the whitespace around it) to one space, so a
  // multi-line question/body can never push the block out of shape.
  const flat = singleLine(text);
  // truncateToWidth: cut to the budget, marking the cut with an ellipsis.
  stdout.write(`${style(truncateToWidth(flat, terminalColumns() - wideGlyphCost(flat)))}\n`);
}
