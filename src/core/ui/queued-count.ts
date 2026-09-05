// How many messages are waiting mid-turn — the number the fenced input row shows so a queued message
// is never confusable with a dropped one.

import { messageQueueState } from './message-queue-state.js';

/** How many messages are waiting. */
export function queuedCount(): number {
  return messageQueueState.queued.length;
}
