// Release the reserved rows: drop the resize listener, reset the scroll region, clear every row.
//
// Clears with ESC[2K on the rows this module wrote itself, one at a time — never ESC[0J, which erases
// to the end of the display and would take the scrollback's last screen with it.

import { stdout } from 'node:process';

import { fencedTerminalRows } from './fenced-terminal-rows.js';
import { statusBarState } from './status-bar-state.js';

/** Release the reserved rows: drop the resize listener, reset the scroll region, clear every row. */
export function disableStatusBar(): void {
  if (!statusBarState.active) return;
  const rows = fencedTerminalRows();
  const hadFence = statusBarState.fenceRow !== null;
  statusBarState.active = false;
  statusBarState.fenceRow = null;
  if (statusBarState.onResize) {
    stdout.removeListener('resize', statusBarState.onResize);
    statusBarState.onResize = null;
  }
  stdout.write('\x1b[r'); // reset scroll region to the full screen
  if (rows !== null) {
    if (hadFence) {
      stdout.write(`\x1b[${rows - 4};1H\x1b[2K`); // clear the input fence's rule row
      stdout.write(`\x1b[${rows - 3};1H\x1b[2K`); // clear the type-ahead row
    }
    stdout.write(`\x1b[${rows - 2};1H\x1b[2K`); // clear the rule row
    stdout.write(`\x1b[${rows - 1};1H\x1b[2K`); // clear the status row
    stdout.write(`\x1b[${rows};1H\x1b[2K`); // clear the footer row
  }
}
