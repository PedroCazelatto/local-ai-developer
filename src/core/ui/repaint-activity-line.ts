// Advance the spinner and redraw the activity line in place, on the REPL's ticker.
//
// Clears with ESC[2K on the row it wrote itself and never ESC[0J, which would erase to the end of the
// display and wipe the pinned status rows below the scroll region.

import { stdout } from 'node:process';

import { activityLineState } from './activity-line-state.js';
import { activityLineText } from './activity-line-text.js';

/** Advance the spinner and repaint the line in place. No-op when hidden; called on the REPL ticker. */
export function repaintActivityLine(): void {
  if (!activityLineState.visible || !stdout.isTTY) return;
  activityLineState.frame += 1;
  // activityLineText: a spinner frame plus the current activity, already dimmed.
  stdout.write(`\r\x1b[2K${activityLineText()}`); // carriage return, clear the row, redraw (never ESC[0J)
}
