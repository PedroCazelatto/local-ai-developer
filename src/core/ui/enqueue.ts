// Add a message to the BACK of the mid-turn queue — Enter while a turn runs (input-fence.ts).

import { messageQueueState } from './message-queue-state.js';

/** Add a message to the back — Enter while a turn runs (input-fence.ts). */
export function enqueue(text: string): void {
  messageQueueState.queued.push(text);
}
