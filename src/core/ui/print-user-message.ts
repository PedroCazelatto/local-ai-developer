// Print a message that was never in the live input box — one queued mid-turn, running now that its
// turn came.
//
// Same gray block as a typed message, since by this point it IS the user's turn; there is simply no
// input box to collapse, and a leading blank line stands in for the separator the prompt would have
// printed above it.

import { stdout } from 'node:process';

import { terminalColumns } from './terminal-columns.js';
import { userMessageBars } from './user-message-bars.js';

/** Print a queued message as the same static gray block a typed one collapses into. */
export function printUserMessage(raw: string): void {
  // userMessageBars: the message word-wrapped under a ` › ` marker as full-width gray rows.
  const bars = userMessageBars(raw, terminalColumns());
  stdout.write(`\n${bars.join('\n')}\n\n`);
}
