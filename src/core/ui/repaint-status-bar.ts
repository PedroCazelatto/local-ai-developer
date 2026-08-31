// Repaint the current rule + status lines on the reserved rows without changing them.
//
// The caller uses this to restore the rows after something erased them: Node's `readline` writes
// `ESC[0J` (erase-to-end-of-display) on every prompt refresh, which wipes the reserved rows — DECSTBM
// fences them off from SCROLLING but not from an explicit erase. So the REPL repaints after each
// prompt draw / keypress (see repl.ts). No-op until enable() succeeds.

import { fencedTerminalRows } from './fenced-terminal-rows.js';
import { paintPinnedRegion } from './paint-pinned-region.js';
import { statusBarState } from './status-bar-state.js';

/** Repaint the reserved rows as they stand. No-op until enable() succeeds. */
export function repaintStatusBar(): void {
  if (!statusBarState.active) return;
  const rows = fencedTerminalRows();
  if (rows !== null) paintPinnedRegion(rows);
}
