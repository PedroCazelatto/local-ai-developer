// A pinned single-row status bar at the very bottom of the terminal. It reserves the last row via
// the DECSTBM scroll region (ESC[top;bottom r) so all normal output — the conversation, the
// prompt, streamed deltas — scrolls in the region ABOVE it and never overwrites the bar. Crucially
// this is NOT the alt-buffer: the main scrollback stays intact and copyable (the whole reason the
// old Rich Live TUI was abandoned), we just fence off one row at the bottom.
//
// Everything here is a no-op when stdout is not a TTY (piped/redirected runs) — there is no row to
// pin and the escapes would just corrupt the output.

import { stdout } from 'node:process';

import { theme } from './theme.js';

/** True only between enable() and disable() on a real TTY. Guards set()/disable() against no-ops. */
let active = false;
/** Last text handed to set(), repainted after a resize so the bar survives terminal reflow. */
let lastText = '';
/** Bound resize listener, kept so disable() can remove exactly the one enable() added. */
let onResize: (() => void) | null = null;

/** Rows in the terminal, or null when unknown / not a TTY / too small to reserve a row. */
function terminalRows(): number | null {
  if (!stdout.isTTY) return null;
  const rows = stdout.rows;
  // Need at least two rows: one to scroll in, one to pin. Anything less and we leave the terminal
  // alone rather than fence it into uselessness.
  return typeof rows === 'number' && rows >= 2 ? rows : null;
}

/** Fence the scroll region to rows 1..(rows-1), leaving the last row for the bar, then paint it. */
function applyRegion(rows: number): void {
  stdout.write(`\x1b[1;${rows - 1}r`); // DECSTBM: set top+bottom margins of the scrolling region
  stdout.write(`\x1b[${rows - 1};1H`); // park the cursor on the last scrolling row (region reset homes it)
  paint(rows);
}

/** Repaint the reserved row without disturbing the cursor the prompt/stream is using. */
function paint(rows: number): void {
  stdout.write('\x1b7'); // save cursor
  stdout.write(`\x1b[${rows};1H`); // jump to the reserved bottom row
  stdout.write('\x1b[2K'); // clear that row
  stdout.write(theme.meta(lastText)); // dim status text — meta styling, same family as system lines
  stdout.write('\x1b8'); // restore cursor
}

/**
 * Reserve the bottom row and start pinning the bar there. Idempotent: a second call just re-applies
 * the region (used internally on resize). No-op off a TTY. Call AFTER any one-time clearScreen so
 * the region is set on a clean screen, and BEFORE the first output that should scroll above it.
 */
export function enable(): void {
  const rows = terminalRows();
  if (rows === null) return;
  if (!onResize) {
    onResize = (): void => {
      const r = terminalRows();
      if (r !== null) applyRegion(r);
    };
    stdout.on('resize', onResize);
  }
  active = true;
  applyRegion(rows);
}

/** Update the pinned text. Stored so a later resize can repaint it. No-op until enable() succeeds. */
export function set(text: string): void {
  if (!active) return;
  lastText = text;
  const rows = terminalRows();
  if (rows !== null) paint(rows);
}

/**
 * Repaint the current text on the reserved row without changing it. The caller uses this to restore
 * the bar after something erased it: Node's `readline` writes `ESC[0J` (erase-to-end-of-display) on
 * every prompt refresh, which wipes the reserved bottom row — DECSTBM fences the row off from
 * SCROLLING but not from an explicit erase. So the REPL repaints after each prompt draw / keypress
 * (see repl.ts). No-op until enable() succeeds.
 */
export function repaint(): void {
  if (!active) return;
  const rows = terminalRows();
  if (rows !== null) paint(rows);
}

/** Release the reserved row: drop the resize listener, reset the scroll region, clear the bar. */
export function disable(): void {
  if (!active) return;
  active = false;
  if (onResize) {
    stdout.removeListener('resize', onResize);
    onResize = null;
  }
  const rows = terminalRows();
  stdout.write('\x1b[r'); // reset scroll region to the full screen
  if (rows !== null) {
    stdout.write(`\x1b[${rows};1H\x1b[2K`); // clear the row that had held the bar
  }
}
