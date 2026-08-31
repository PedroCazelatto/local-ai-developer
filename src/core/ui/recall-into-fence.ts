// ↑ mid-turn: the newest queued message comes back into the fenced row to edit, and the scrollback
// says so too.
//
// Without that line the history would keep claiming a message was queued that never ran — and history
// here is append-only, so the original line cannot be taken back.

import { messageQueue } from './message-queue.js';
import { renderer } from './renderer.js';
import { singleLine } from './single-line.js';
import { theme } from './theme.js';

/** Take the newest queued message back into the row, announcing it. Null when the queue is empty. */
export function recallIntoFence(): string | null {
  const text = messageQueue.recall();
  if (text !== null) renderer.interjectLine(theme.meta(`↩ un-queued: ${singleLine(text)}`));
  return text;
}
