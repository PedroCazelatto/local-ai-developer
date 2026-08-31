// Repaint the type-ahead row with new text — one row, on every keystroke, which is what makes the
// fenced input cheap: it is outside the scroll region, so no output path has to know it is there.

import { fencedTerminalRows } from './fenced-terminal-rows.js';
import { paintPinnedRow } from './paint-pinned-row.js';
import { statusBarState } from './status-bar-state.js';

/** Repaint the type-ahead row with new text (one row, on every keystroke). No-op unless it is up. */
export function setInputFence(row: string): void {
  if (!statusBarState.active || statusBarState.fenceRow === null) return;
  statusBarState.fenceRow = row;
  const rows = fencedTerminalRows();
  if (rows !== null) paintPinnedRow(rows - 3, statusBarState.fenceRow);
}
