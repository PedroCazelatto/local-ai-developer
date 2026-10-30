// Draw the transient activity line at the cursor.

import { stdout } from 'node:process';

import { activityLineState } from './activity-line-state.js';
import { activityLineText } from './activity-line-text.js';

/** Draw the activity line at the cursor. Idempotent (a second show() is a no-op). TTY only. */
export function showActivityLine(): void {
  if (activityLineState.visible || !stdout.isTTY) return;
  activityLineState.visible = true;
  // activityLineText: a spinner frame plus the current activity, already dimmed.
  stdout.write(activityLineText());
}
