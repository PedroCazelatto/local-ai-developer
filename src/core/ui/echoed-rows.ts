// How many terminal rows a string occupies when echoed at the current width — computed the way the
// terminal (and Node's readline) actually wrap, so the input-box erase in renderer.ts lands on the
// exact row readline left the cursor on. Two wrap triggers, and BOTH matter:
//
//   1. Overflow: a glyph that will not fit in the columns left wraps to the next row (a double-width
//      glyph straddling the last column leaves that column blank and moves down).
//   2. Exact fill: a glyph landing on the LAST column advances to the next row immediately (deferred
//      wrap resolved). readline's getCursorPos reports this extra row, so a line of width EXACTLY the
//      terminal width occupies two rows' worth of cursor travel, not one.
//
// A plain `ceil(width / cols)` gets (2) wrong — it undercounts by one at every exact multiple of the
// width — and that undercount is what stranded the transient input rule in scrollback (a rule leaking
// between messages). Widths come from codePointWidth so CJK/fullwidth/emoji count as two columns,
// matching readline's getStringWidth; iterating by code point keeps a surrogate pair one glyph.

import { codePointWidth } from './code-point-width.js';
import { terminalColumns } from './terminal-columns.js';

/** SGR / CSI escape sequences occupy zero columns — stripped so a pasted escape can't skew the count. */
const ANSI = /\x1b\[[0-9;]*[A-Za-z]/g;

/** Physical terminal rows `text` occupies when echoed at the current width (minimum one). */
export function echoedRows(text: string): number {
  const cols = terminalColumns();
  let rows = 1;
  let col = 0;
  for (const glyph of text.replace(ANSI, '')) {
    const width = codePointWidth(glyph.codePointAt(0) ?? 0);
    if (col + width > cols) {
      rows += 1; // overflow: this glyph starts a new row
      col = 0;
    }
    col += width;
    if (col === cols) {
      rows += 1; // exact fill: the cursor sits at the start of the next row
      col = 0;
    }
  }
  return rows;
}
