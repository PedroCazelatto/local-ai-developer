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
import type { RowStyle } from './row-style.type.js';
import { wideGlyphCost } from './wide-glyph-cost.js'; // the columns a row costs beyond its character count

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
