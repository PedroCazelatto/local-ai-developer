// A turn ended: on the LAST outstanding begin, give stdin back and drop the fence.
//
// The buffer OUTLIVES a single turn on purpose. A `/run` task loop is many turns with gaps between
// them, and text typed during the Worker must still be there when the Reviewer's turn ends; the REPL
// drains it into the next real prompt, where readline takes over with full editing.

import { inputFenceState } from './input-fence-state.js';
import { statusBar } from './status-bar.js';

/** A turn ended: on the last outstanding begin, give stdin back and drop the fence. */
export function endInputFence(): void {
  if (inputFenceState.depth > 0) inputFenceState.depth -= 1;
  if (inputFenceState.depth > 0) return;
  if (inputFenceState.stop !== null) {
    inputFenceState.pending = inputFenceState.stop();
    inputFenceState.stop = null;
  }
  statusBar.hideInputFence();
}
