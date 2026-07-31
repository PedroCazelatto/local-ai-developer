// Messages the user submitted while a turn was running, waiting to run in the order they were sent.
//
// A tiny FIFO with one deliberate exception: ↑ takes from the BACK, because "give me back what I just
// queued" always means the most recent one, while the run order is the order they were written. Two
// ends, two meanings — hence dequeue and recall rather than one generic take.
//
// The queue is UI state, not session state: nothing here reaches the model, and a message only becomes
// a turn when the REPL drains it (repl.ts) exactly as if it had been typed at the prompt.

/** Submitted mid-turn, oldest first. */
const queued: string[] = [];

/** Add a message to the back — Enter while a turn runs (input-fence.ts). */
export function enqueue(text: string): void {
  queued.push(text);
}

/** Take the OLDEST message, or null when the queue is empty. The REPL's drain order. */
export function dequeue(): string | null {
  return queued.shift() ?? null;
}

/** Take the NEWEST message back off the queue, or null when empty — what ↑ pulls into the input. */
export function recall(): string | null {
  return queued.pop() ?? null;
}

/** How many messages are waiting. */
export function size(): number {
  return queued.length;
}
