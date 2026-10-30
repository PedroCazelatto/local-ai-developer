// Repaint one reserved row with already-styled text, without disturbing the cursor the prompt uses.
//
// Callers pass FULLY-STYLED text (chalk already applied) and it is painted verbatim, with no blanket
// dim — that is what lets status line 1's color-coded active phase render in its bright theme color
// while the rest of the line stays dim. Clears with ESC[2K on the row it owns, never ESC[0J.

import { stdout } from 'node:process';

/** Repaint one reserved row with already-styled text, without disturbing the cursor the prompt uses. */
export function paintPinnedRow(row: number, text: string): void {
  stdout.write('\x1b7'); // save cursor
  stdout.write(`\x1b[${row};1H`); // jump to the reserved row
  stdout.write('\x1b[2K'); // clear that row
  stdout.write(text); // caller-styled — painted verbatim (no blanket dim)
  stdout.write('\x1b8'); // restore cursor
}
