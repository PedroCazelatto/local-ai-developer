// Fence the scroll region above the reserved rows, park the cursor on its last row, then paint.
//
// DECSTBM homes the cursor as a side effect, which is why the cursor is repositioned explicitly right
// after — this is the path taken at enable() and on resize, where nothing is mid-output and homing is
// therefore safe to correct rather than to avoid (resize-scroll-region.ts is the other case).

import { stdout } from 'node:process';

import { paintPinnedRegion } from './paint-pinned-region.js';
import { reservedRowCount } from './reserved-row-count.js';

/** Fence the scroll region above the reserved rows, park the cursor on its last row, then paint. */
export function applyScrollRegion(rows: number): void {
  stdout.write(`\x1b[1;${rows - reservedRowCount()}r`); // DECSTBM: set top+bottom margins of the scrolling region
  stdout.write(`\x1b[${rows - reservedRowCount()};1H`); // park the cursor on the last scrolling row (reset homes it)
  // paintPinnedRegion: the fence rows if up, then the rule and both status lines.
  paintPinnedRegion(rows);
}
