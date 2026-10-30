// An empty submit adds nothing to history — just erase the box (TTY) and move on.

import { stdout } from 'node:process';

import { eraseInputBox } from './erase-input-box.js';

/** An empty submit adds nothing to history — just erase the box (TTY) and move on. */
export function discardInput(raw: string): void {
  // eraseInputBox: the top rule plus every row the echoed input wrapped onto.
  if (stdout.isTTY) eraseInputBox(raw);
}
