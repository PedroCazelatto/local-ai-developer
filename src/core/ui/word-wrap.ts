// Wrap text to a column width by breaking ONLY at spaces, never in the middle of a word — the space
// at each break becomes the line break. This is what makes both the user's gray message bars and the
// model's replies wrap cleanly instead of splitting words at the raw terminal edge.
//
// Details that matter:
//   - Widths are display columns (visibleWidth): ANSI escapes are zero-width and CJK/emoji are two.
//   - Leading indentation is preserved and re-applied to every wrapped row (a hanging indent), so a
//     list item or blockquote keeps its shape.
//   - A word too long to ever fit is split as a last resort (fitWord) — the only time a break lands
//     mid-word, because there is no space to break at.
//   - Styling that is still open at a break is closed on the line and reopened on the next (openSgr),
//     so a colored/bold span crossing a wrap neither bleeds into padding nor drops on the continuation.

import { fitWord } from './fit-word.js';
import { openSgr } from './open-sgr.js';
import { visibleWidth } from './visible-width.js';

/** Reset-all: closes any styling left open at the end of a wrapped line. */
const RESET = '\x1b[0m';

/** `text` wrapped to `width` display columns, broken only at spaces (min one line, never empty-only). */
export function wordWrap(text: string, width: number): string[] {
  if (width <= 0) return [text];
  const indent = (/^ */.exec(text) ?? [''])[0];
  const usable = Math.max(1, width - indent.length);
  const words = text.slice(indent.length).split(/ +/).filter((w) => w !== '');

  const lines: string[] = [];
  let cur = ''; // current line's content after the indent (may begin with reopened styling)
  let curWidth = 0;
  // Close the current line (reopening styling on the next), then reset for the next line.
  const flush = (): void => {
    const carry = openSgr(cur);
    lines.push(`${indent}${cur}${carry === '' ? '' : RESET}`);
    cur = carry; // a straddling span is reopened at the start of the next line
    curWidth = 0;
  };

  for (const word of words) {
    const pieces = fitWord(word, usable); // usually [word]; multiple only for an over-long word
    pieces.forEach((piece, idx) => {
      const pieceWidth = visibleWidth(piece);
      if (curWidth === 0) {
        cur += piece; // start of a line: no leading space (cur may hold a zero-width carry)
        curWidth = pieceWidth;
      } else if (curWidth + 1 + pieceWidth <= usable) {
        cur += ` ${piece}`;
        curWidth += 1 + pieceWidth;
      } else {
        flush();
        cur += piece;
        curWidth = pieceWidth;
      }
      if (idx < pieces.length - 1) flush(); // the rest of an over-long word continues on the next row
    });
  }

  const carry = openSgr(cur);
  lines.push(`${indent}${cur}${carry === '' ? '' : RESET}`);
  return lines;
}
