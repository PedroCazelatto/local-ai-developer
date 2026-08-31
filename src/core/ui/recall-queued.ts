// Take the NEWEST message back OFF the mid-turn queue — what ↑ pulls into the fenced input row.
//
// The one deliberate exception to the queue's FIFO shape: "give me back what I just queued" always
// means the most recent one, while the run order is the order they were written. Two ends, two
// meanings — hence this beside dequeue rather than one generic take.

import { messageQueueState } from './message-queue-state.js';

/** Take the NEWEST message back off the queue, or null when empty — what ↑ pulls into the input. */
export function recallQueued(): string | null {
  return messageQueueState.queued.pop() ?? null;
}
