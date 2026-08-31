// Re-fence the scroll region for a CHANGED reserved count, leaving the cursor exactly where it was.
//
// DECSTBM homes the cursor as a side effect, which would abandon the output in progress — hence the
// save/restore pair around it. Only safe because nothing scrolls in between.

import { stdout } from 'node:process';

import { reservedRowCount } from './reserved-row-count.js';

/** Re-fence the scroll region for a changed reserved count, leaving the cursor exactly where it was. */
export function resizeScrollRegion(rows: number): void {
  stdout.write('\x1b7'); // save cursor
  stdout.write(`\x1b[1;${rows - reservedRowCount()}r`);
  stdout.write('\x1b8'); // restore cursor
}
