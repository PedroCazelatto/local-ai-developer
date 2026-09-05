// Update the two pinned STATUS lines (already styled). Stored so a later resize can repaint them
// after the terminal reflows. No-op until the status bar is enabled.

import { fencedTerminalRows } from './fenced-terminal-rows.js';
import { paintPinnedRow } from './paint-pinned-row.js';
import { statusBarState } from './status-bar-state.js';

/** Update the two pinned STATUS lines (already styled). No-op until enable(). */
export function setStatus(line1: string, line2: string): void {
  if (!statusBarState.active) return;
  statusBarState.statusLine1 = line1;
  statusBarState.statusLine2 = line2;
  const rows = fencedTerminalRows();
  if (rows !== null) {
    paintPinnedRow(rows - 1, statusBarState.statusLine1);
    paintPinnedRow(rows, statusBarState.statusLine2);
  }
}
