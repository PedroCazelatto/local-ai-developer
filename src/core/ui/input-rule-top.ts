// The transient rule printed directly ABOVE the live input.
//
// It is erased when the message is committed (commit-user-message.ts), so it never lands in history —
// the pinned rule BELOW the input (status-bar.ts) is the other half of the fence. TTY only: off a TTY
// there is no cursor to erase it with later, so it is simply omitted.

import { stdout } from 'node:process';

import { terminalColumns } from './terminal-columns.js';
import { theme } from './theme.js';

/** The transient rule printed directly above the live input. TTY only. */
export function inputRuleTop(): void {
  if (!stdout.isTTY) return;
  stdout.write(`${theme.divider('─'.repeat(terminalColumns()))}\n`);
}
