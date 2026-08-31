// Erase the transient activity line, leaving the cursor at column 1 of its now-blank row so the next
// output reuses it — which is what keeps the widget out of the append-only scrollback entirely.

import { stdout } from 'node:process';

import { activityLineState } from './activity-line-state.js';

/** Erase the line, leaving the cursor at column 1 of its (now blank) row so the next output reuses it. */
export function hideActivityLine(): void {
  if (!activityLineState.visible) return;
  activityLineState.visible = false;
  if (stdout.isTTY) stdout.write('\r\x1b[2K');
}
