// Enter mid-turn: the message joins the queue the REPL drains when the turn ends, and says so in the
// scrollback right away — a message that vanished into a queue with no trace would be
// indistinguishable from one that was dropped. interjectLine is what makes that safe to print into a
// reply in flight.
//
// A control line such as `/stop` acts NOW rather than joining the queue: queueing one would be
// useless, since the queue drains only when the whole `/run` finishes, which is precisely the thing
// being asked to stop. It defaults to "not handled" when no handler is registered, so off a REPL the
// fence behaves as it always did.

import { inputFenceState } from './input-fence-state.js';
import { messageQueue } from './message-queue.js';
import { renderer } from './renderer.js';
import { singleLine } from './single-line.js';
import { theme } from './theme.js';

/** A line submitted from the fenced row: a control instruction, or a message for the queue. */
export function submitFenceLine(text: string): void {
  if (inputFenceState.controlHandler?.(text) === true) return;
  messageQueue.enqueue(text);
  // interjectLine: prints through a reply in flight, lifting and laying back the live row.
  renderer.interjectLine(theme.meta(`⏳ queued: ${singleLine(text)}`));
}
