// The terminal's height, but only when the pinned region can actually have it — deliberately NOT the
// row-counting twin of terminal-columns.ts.
//
// It answers null in three cases the status bar must treat identically: not a TTY, no reported row
// count, or a terminal too short to give up the reserved rows and still leave one to scroll in.
// Anything less and we leave the terminal alone rather than fence it into uselessness.

import { stdout } from 'node:process';

import { reservedRowCount } from './reserved-row-count.js';

/** Rows in the terminal, or null when unknown / not a TTY / too small to reserve the pinned region. */
export function fencedTerminalRows(): number | null {
  if (!stdout.isTTY) return null;
  const rows = stdout.rows;
  // reservedRowCount: three while idle, five while the input fence is up.
  return typeof rows === 'number' && rows >= reservedRowCount() + 1 ? rows : null;
}
