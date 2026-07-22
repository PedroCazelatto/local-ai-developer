// Three pinned rows at the very bottom of the terminal: a full-width RULE, then TWO STATUS lines. They
// are reserved via the DECSTBM scroll region (ESC[top;bottom r) so all normal output — the
// conversation, the prompt, streamed deltas — scrolls in the region ABOVE them and never overwrites
// them. Crucially this is NOT the alt-buffer: the main scrollback stays intact and copyable (the whole
// reason the old Rich Live TUI was abandoned), we just fence off rows.
//
// The RULE row sits directly under the live input, so it reads as the line BELOW the input while the
// user types (its other half — a transient rule ABOVE the input — is printed and erased in
// renderer.ts). During streaming the same rule reads as a divider above the status lines.
//
// Callers pass FULLY-STYLED text (chalk already applied): this module paints it verbatim and does NOT
// blanket-dim, so status line 1's color-coded active phase renders in its bright theme color while the
// rest stays dim — the caller composes that mix. The one exception is the rule row, which this module
// generates itself (theme.divider at the current width) since its content is width-derived.
//
// Everything here is a no-op when stdout is not a TTY (piped/redirected runs) — there are no rows to
// pin and the escapes would just corrupt the output.

import { stdout } from 'node:process';

import { terminalColumns } from './terminal-columns.js';
import { theme } from './theme.js';

/** Rows reserved at the bottom: the rule, then status line 1, then status line 2. */
const RESERVED = 3;

/** True only between enable() and disable() on a real TTY. Guards setters/disable() against no-ops. */
let active = false;
/** Last status lines handed to setStatus(), repainted after a resize so they survive reflow. */
let statusLine1 = '';
let statusLine2 = '';
/** Bound resize listener, kept so disable() can remove exactly the one enable() added. */
let onResize: (() => void) | null = null;

/** Rows in the terminal, or null when unknown / not a TTY / too small to reserve the pinned region. */
function terminalRows(): number | null {
  if (!stdout.isTTY) return null;
  const rows = stdout.rows;
  // Need at least one row to scroll in plus the reserved rows. Anything less and we leave the
  // terminal alone rather than fence it into uselessness.
  return typeof rows === 'number' && rows >= RESERVED + 1 ? rows : null;
}

/** Fence the scroll region to rows 1..(rows-RESERVED), leaving the last two rows pinned, then paint. */
function applyRegion(rows: number): void {
  stdout.write(`\x1b[1;${rows - RESERVED}r`); // DECSTBM: set top+bottom margins of the scrolling region
  stdout.write(`\x1b[${rows - RESERVED};1H`); // park the cursor on the last scrolling row (reset homes it)
  paint(rows);
}

/** Repaint one reserved row with already-styled text, without disturbing the cursor the prompt uses. */
function paintRow(row: number, text: string): void {
  stdout.write('\x1b7'); // save cursor
  stdout.write(`\x1b[${row};1H`); // jump to the reserved row
  stdout.write('\x1b[2K'); // clear that row
  stdout.write(text); // caller-styled — painted verbatim (no blanket dim)
  stdout.write('\x1b8'); // restore cursor
}

/** The pinned rule row directly under the input: a full-width dim divider at the current width. */
function dividerText(): string {
  return theme.divider('─'.repeat(terminalColumns()));
}

/** Repaint the reserved rows: the rule, then status line 1, then status line 2 (bottom-most). */
function paint(rows: number): void {
  paintRow(rows - 2, dividerText());
  paintRow(rows - 1, statusLine1);
  paintRow(rows, statusLine2);
}

/**
 * Reserve the two bottom rows and start pinning. Idempotent: a second call just re-applies the region
 * (used internally on resize). No-op off a TTY. Call AFTER any one-time clearScreen so the region is
 * set on a clean screen, and BEFORE the first output that should scroll above it.
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

/**
 * Update the two pinned STATUS lines (already styled). Stored so a later resize can repaint them.
 * No-op until enable().
 */
export function setStatus(line1: string, line2: string): void {
  if (!active) return;
  statusLine1 = line1;
  statusLine2 = line2;
  const rows = terminalRows();
  if (rows !== null) {
    paintRow(rows - 1, statusLine1);
    paintRow(rows, statusLine2);
  }
}

/**
 * Repaint the current rule + status lines on the reserved rows without changing them. The caller uses this
 * to restore the rows after something erased them: Node's `readline` writes `ESC[0J`
 * (erase-to-end-of-display) on every prompt refresh, which wipes the reserved rows — DECSTBM fences
 * them off from SCROLLING but not from an explicit erase. So the REPL repaints after each prompt draw /
 * keypress (see repl.ts). No-op until enable() succeeds.
 */
export function repaint(): void {
  if (!active) return;
  const rows = terminalRows();
  if (rows !== null) paint(rows);
}

/** Release the reserved rows: drop the resize listener, reset the scroll region, clear all three rows. */
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
    stdout.write(`\x1b[${rows - 2};1H\x1b[2K`); // clear the rule row
    stdout.write(`\x1b[${rows - 1};1H\x1b[2K`); // clear the status row
    stdout.write(`\x1b[${rows};1H\x1b[2K`); // clear the footer row
  }
}
