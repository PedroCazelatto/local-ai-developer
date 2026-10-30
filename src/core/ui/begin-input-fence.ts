// A turn started: raise the fence and take stdin, seeded with anything typed during an earlier turn.
//
// REENTRANT: a sub-agent runs its own processMessage inside a tool call of the turn that spawned it,
// so the inner begin must share the outer's fence. Hence the depth count — the fence goes up on the
// first begin and comes down on the last end.
//
// Off a TTY there is nothing to pin and no keypress events to read, so it does nothing at all.

import { stdin, stdout } from 'node:process';

import { captureTypeAhead } from './capture-type-ahead.js';
import { inputFenceRow } from './input-fence-row.js';
import { inputFenceState } from './input-fence-state.js';
import { messageQueue } from './message-queue.js';
import { offerFenceCancel } from './offer-fence-cancel.js';
import { paintFenceRow } from './paint-fence-row.js';
import { recallIntoFence } from './recall-into-fence.js';
import { statusBar } from './status-bar.js';
import { submitFenceLine } from './submit-fence-line.js';
import { terminalColumns } from './terminal-columns.js';

/** A turn started: raise the fence and take stdin. Reentrant — only the first begin does the work. */
export function beginInputFence(): void {
  inputFenceState.depth += 1;
  if (inputFenceState.depth > 1 || inputFenceState.stop !== null) return;
  if (!stdin.isTTY || !stdout.isTTY) return;
  // captureTypeAhead: suspends every keypress listener (readline's included, so nothing echoes into
  // the streamed reply) and owns the keys until the returned stop() restores them — printable keys and
  // backspace build the row, Enter queues it, ↑ takes the last one back.
  inputFenceState.stop = captureTypeAhead(stdin, inputFenceState.pending, {
    onChange: paintFenceRow,
    onSubmit: submitFenceLine,
    onRecall: recallIntoFence,
    onCancel: offerFenceCancel,
  });
  statusBar.showInputFence(inputFenceRow(inputFenceState.pending, terminalColumns(), messageQueue.size()));
}
