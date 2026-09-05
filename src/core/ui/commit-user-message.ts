// Collapse the just-submitted input box into a static, copyable gray block: the user's message on a
// light-gray background, then a blank line before the assistant reply.
//
// This is the transient-widget pattern (constitution, Terminal UX) — the live box erases its own frame
// and leaves a single summary in the append-only scrollback. Off a TTY nothing was erasable, so it
// just prints the summary.

import { stdout } from 'node:process';

import { eraseInputBox } from './erase-input-box.js';
import { terminalColumns } from './terminal-columns.js';
import { userMessageBars } from './user-message-bars.js';

/** Collapse the submitted input box into one static gray block, then a blank line. */
export function commitUserMessage(raw: string): void {
  // userMessageBars: the message word-wrapped under a ` › ` marker as full-width gray rows.
  const bars = userMessageBars(raw, terminalColumns());
  // eraseInputBox: the top rule plus every row the echoed input wrapped onto.
  if (stdout.isTTY) eraseInputBox(raw);
  stdout.write(`${bars.join('\n')}\n\n`);
}
