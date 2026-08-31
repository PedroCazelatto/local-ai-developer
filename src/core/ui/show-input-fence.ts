// Raise the input fence: reserve two more rows and paint the rule + `row` into them.
//
// Idempotent while it is up, and a no-op on a terminal with too few rows to give up another two (the
// session keeps its three pinned rows and simply shows no fence).
//
// The two newlines are what keep this lossless. At the bottom margin they scroll the region, so the
// rows we take are blank and the content that made way for them leaves through the scrollback exactly
// as it always does; anywhere else they cost nothing, since output is append-only and nothing is ever
// printed below the cursor. ESC[2A then puts the cursor back on its own row, which — the caller being
// a turn that begins on a fresh row — is column 1 of a blank line either way.

import { stdout } from 'node:process';

import { paintPinnedRegion } from './paint-pinned-region.js';
import { resizeScrollRegion } from './resize-scroll-region.js';
import { RESERVED_BUSY } from './status-bar-rows.js';
import { statusBarState } from './status-bar-state.js';

/** Raise the input fence, painting `row` into the type-ahead row. Idempotent while it is up. */
export function showInputFence(row: string): void {
  if (!statusBarState.active || statusBarState.fenceRow !== null || !stdout.isTTY) return;
  const rows = stdout.rows;
  if (typeof rows !== 'number' || rows < RESERVED_BUSY + 1) return;
  stdout.write('\n\n\x1b[2A');
  statusBarState.fenceRow = row;
  // resizeScrollRegion: re-fence for the new reserved count without moving the cursor.
  resizeScrollRegion(rows);
  paintPinnedRegion(rows);
}
