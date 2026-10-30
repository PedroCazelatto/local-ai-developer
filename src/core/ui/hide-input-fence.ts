// Drop the input fence: blank its two rows and give them back to the scrolling area.

import { fencedTerminalRows } from './fenced-terminal-rows.js';
import { paintPinnedRow } from './paint-pinned-row.js';
import { resizeScrollRegion } from './resize-scroll-region.js';
import { statusBarState } from './status-bar-state.js';

/** Drop the input fence: blank its two rows and give them back to the scrolling area. */
export function hideInputFence(): void {
  if (!statusBarState.active || statusBarState.fenceRow === null) return;
  const rows = fencedTerminalRows();
  if (rows !== null) {
    paintPinnedRow(rows - 4, '');
    paintPinnedRow(rows - 3, '');
  }
  statusBarState.fenceRow = null; // before resizeScrollRegion: reservedRowCount reads this to size the region it restores
  if (rows !== null) resizeScrollRegion(rows);
}
