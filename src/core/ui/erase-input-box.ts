// Erase the transient input box still under the cursor — the top rule plus every row the echoed input
// wrapped onto — leaving the cursor at the box's first row, column 1.
//
// Clears with ESC[2K on rows we wrote ourselves (never ESC[0J, which would wipe the pinned status rows
// below the scroll region).
//
// echoedRows measures the PROMPT + input together, wrapping exactly as readline does (so an exact-fill
// line's deferred-wrap row and wide glyphs are both counted) — that keeps `rows` matched to where
// readline left the cursor, so the top rule is always cleared and never leaks into scrollback.

import { stdout } from 'node:process';

import { echoedRows } from './echoed-rows.js';
import { INPUT_PROMPT } from './input-prompt.js';

/** Erase the input box under the cursor, leaving the cursor at its first row, column 1. */
export function eraseInputBox(raw: string): void {
  const rows = echoedRows(`${INPUT_PROMPT}${raw}`) + 1; // + the top rule
  stdout.write(`\x1b[${rows}A\r`); // up to the top rule's row, column 1
  for (let row = 0; row < rows; row += 1) {
    stdout.write('\x1b[2K');
    if (row < rows - 1) stdout.write('\x1b[1B');
  }
  stdout.write(`\x1b[${rows - 1}A\r`); // back to the top of the now-blank block
}
