// Put a literal newline into readline's live edit buffer at the cursor, and redraw.
//
// The newline is a real character in `rl.line`, not a separate accumulated row, and that is the whole
// point: readline's own display math already understands `\n` (its getCursorPos counts a row per one),
// so every editing key keeps working across the break — backspace at column 1 joins back to the
// previous line, the arrows walk the whole buffer, and one Enter submits the lot as a single message.
//
// Nothing here reaches into readline's internals. `line` and `cursor` are documented fields (widened
// from readonly by insert-newline.type.ts, no `as` involved) and `rl.prompt(true)` is public API that
// is precisely a cursor-preserving line refresh. The rendering stays entirely readline's, so a
// multi-line buffer wraps and repositions exactly like a single-line one.

import type { Interface as ReadlineInterface } from 'node:readline/promises';

import type { EditableLine } from './insert-newline.type.js';

/** Insert `\n` at the cursor of `rl`'s current input line, leaving the cursor after the break. */
export function insertNewline(rl: ReadlineInterface): void {
  const buffer: EditableLine = rl;
  const before = buffer.line.slice(0, buffer.cursor);
  const after = buffer.line.slice(buffer.cursor);
  buffer.line = `${before}\n${after}`;
  buffer.cursor = before.length + 1;
  rl.prompt(true); // public cursor-preserving refresh — repaints the now-taller input in place
}
