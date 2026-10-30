// Put a whole new line into readline's live edit buffer and redraw it — how a Tab cycle swaps one
// candidate for the next (cycle-completion.ts computes the line; this lands it).
//
// Nothing here reaches into readline's internals, for the same reason insert-newline.ts does not:
// `line` and `cursor` are documented fields that @types/node declares readonly, so the write goes
// through EditableLine — which widens them by assignment, with no `as` involved — and `rl.prompt(true)`
// is public API that is precisely a cursor-preserving refresh. Reusing that type rather than restating
// it keeps ONE description of why writing those two fields is legitimate.
//
// The refresh emits readline's usual ESC[0J, which erases the pinned status rows; the REPL's keypress
// handler repaints them on the same tick, exactly as it does for an ordinary keystroke.

import type { Interface as ReadlineInterface } from 'node:readline/promises';

import type { EditableLine } from '../core/ui/insert-newline.js';

/** Replace `rl`'s current input line with `line`, leaving the cursor at offset `cursor`. */
export function replaceInputLine(rl: ReadlineInterface, line: string, cursor: number): void {
  const buffer: EditableLine = rl;
  buffer.line = line;
  buffer.cursor = cursor;
  rl.prompt(true); // public cursor-preserving refresh — repaints the edited line in place
}
