// Repaint every reserved row, bottom-most last: the input fence (rule + type-ahead row) when a turn is
// running, then the rule, status line 1, and status line 2.

import { dividerText } from './divider-text.js';
import { paintPinnedRow } from './paint-pinned-row.js';
import { statusBarState } from './status-bar-state.js';

/** Repaint the reserved rows of a `rows`-tall terminal, bottom-most last. */
export function paintPinnedRegion(rows: number): void {
  // paintPinnedRow: one already-styled row, cursor saved and restored around it.
  if (statusBarState.fenceRow !== null) {
    paintPinnedRow(rows - 4, dividerText());
    paintPinnedRow(rows - 3, statusBarState.fenceRow);
  }
  paintPinnedRow(rows - 2, dividerText());
  paintPinnedRow(rows - 1, statusBarState.statusLine1);
  paintPinnedRow(rows, statusBarState.statusLine2);
}
