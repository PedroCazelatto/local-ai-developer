// How many terminal rows a string occupies when echoed at the current width — so the input-box erase
// in renderer.ts lands on the exact row readline left the cursor on.
//
// This mirrors readline's OWN cursor arithmetic (its internal `_getDisplayPos`) rather than
// approximating it, because readline is what places the cursor: after each refresh it emits a relative
// `ESC[nA` / `ESC[nG` computed from that arithmetic. Anything we compute differently would erase from
// the wrong row, and it was exactly such an off-by-one that once stranded the transient input rule in
// the scrollback (a rule leaking between messages).
//
// Hence the counter is a running COLUMN OFFSET across the whole logical line, converted to rows only
// at a newline and at the end — not a per-row column that resets on wrap. The difference shows up in
// the corner where the two disagree:
//
//   - Exact fill: text of width exactly N*cols leaves the cursor at the start of the next row, so it
//     costs a row of cursor travel. A plain `ceil(width / cols)` undercounts it at every exact multiple.
//   - Exact fill IMMEDIATELY followed by a newline costs that row only ONCE, not twice. Terminals defer
//     the wrap (a glyph landing in the last column arms a pending wrap instead of moving the cursor),
//     and the newline's carriage return cancels it. `rows += ceil(offset / cols) || 1` folds the two
//     together the same way readline does.
//
// Literal newlines are here at all because the multi-line input buffer (Shift+Enter) puts real `\n`s
// in the line readline echoes. Each returns to column 1 as well as dropping a row: the tty is in
// ONLCR — libuv keeps that output flag set even in raw mode, and conhost does the same on Windows —
// so a bare LF reaches the screen as CR+LF.
//
// Widths come from codePointWidth so CJK/fullwidth/emoji count as two columns, matching readline's
// getStringWidth; iterating by code point keeps a surrogate pair one glyph.

import { codePointWidth } from './code-point-width.js';
import { terminalColumns } from './terminal-columns.js';

/** SGR / CSI escape sequences occupy zero columns — stripped so a pasted escape can't skew the count. */
const ANSI = /\x1b\[[0-9;]*[A-Za-z]/g;

/** Physical terminal rows `text` occupies when echoed at the current width (minimum one). */
export function echoedRows(text: string): number {
  const cols = terminalColumns();
  let rows = 0; // row advances already banked by newlines
  let offset = 0; // columns consumed since the last newline; may exceed `cols` and is folded in below
  for (const glyph of text.replace(ANSI, '')) {
    if (glyph === '\n') {
      rows += Math.ceil(offset / cols) || 1; // `|| 1`: an empty line still drops a row
      offset = 0;
      continue;
    }
    const width = codePointWidth(glyph.codePointAt(0) ?? 0);
    // A double-width glyph cannot straddle the right edge: it leaves the last column blank and starts
    // the next row, which costs one extra column of offset.
    if (width === 2 && (offset + 1) % cols === 0) offset += 1;
    offset += width;
  }
  return rows + Math.floor(offset / cols) + 1;
}
