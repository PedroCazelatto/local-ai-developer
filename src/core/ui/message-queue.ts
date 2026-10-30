// Messages the user submitted while a turn was running, waiting to run in the order they were sent.
//
// A tiny FIFO with one deliberate exception: ↑ takes from the BACK, because "give me back what I just
// queued" always means the most recent one, while the run order is the order they were written. Two
// ends, two meanings — hence dequeue and recall rather than one generic take.
//
// The queue is UI state, not session state: nothing here reaches the model, and a message only becomes
// a turn when the REPL drains it (repl.ts) exactly as if it had been typed at the prompt.
//
// An ASSEMBLER: one function per file put the four operations in four files, and this composes them
// into the single object callers already used it as. It exports that object and nothing else. The
// queue itself lives in message-queue-state.ts, which only these four may write.

import { dequeue } from './dequeue.js';
import { enqueue } from './enqueue.js';
import { queuedCount } from './queued-count.js';
import { recallQueued } from './recall-queued.js';

/** The mid-turn message queue: add at the back, take the oldest to run or the newest back to edit. */
export const messageQueue = {
  enqueue,
  dequeue,
  recall: recallQueued,
  size: queuedCount,
};
