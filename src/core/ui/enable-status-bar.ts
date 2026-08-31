// Reserve the bottom rows and start pinning.
//
// Idempotent: a second call just re-applies the region (which is what the resize listener does). A
// no-op off a TTY, where there are no rows to pin and the escapes would corrupt piped output. Call
// AFTER any one-time clearScreen so the region is set on a clean screen, and BEFORE the first output
// that should scroll above it.

import { stdout } from 'node:process';

import { applyScrollRegion } from './apply-scroll-region.js';
import { fencedTerminalRows } from './fenced-terminal-rows.js';
import { statusBarState } from './status-bar-state.js';

/** Reserve the pinned rows and start painting them. Idempotent. No-op off a TTY. */
export function enableStatusBar(): void {
  // fencedTerminalRows: the terminal's height, or null when it cannot give the rows up.
  const rows = fencedTerminalRows();
  if (rows === null) return;
  if (!statusBarState.onResize) {
    statusBarState.onResize = (): void => {
      const r = fencedTerminalRows();
      if (r !== null) applyScrollRegion(r);
    };
    stdout.on('resize', statusBarState.onResize);
  }
  statusBarState.active = true;
  // applyScrollRegion: DECSTBM the region, park the cursor, paint the reserved rows.
  applyScrollRegion(rows);
}
