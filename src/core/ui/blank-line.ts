// A single blank line — the separator between turns. History is blank-separated, never ruled: the two
// rules the interface draws both belong to the live input box and are erased when it is committed.

import { stdout } from 'node:process';

/** A single blank line — the separator between turns (history is blank-separated, never ruled). */
export function blankLine(): void {
  stdout.write('\n');
}
