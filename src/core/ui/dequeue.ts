// Take the OLDEST message off the mid-turn queue — the REPL's drain order, which is the order the
// user wrote them in.

import { messageQueueState } from './message-queue-state.js';

/** Take the OLDEST message, or null when the queue is empty. The REPL's drain order. */
export function dequeue(): string | null {
  return messageQueueState.queued.shift() ?? null;
}
