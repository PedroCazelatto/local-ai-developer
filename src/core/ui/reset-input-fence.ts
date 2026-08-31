// Force the fence down whatever the depth, keeping the buffer.
//
// The REPL calls this after each command so a turn that threw between begin() and end() can never
// leave stdin captured — which would be a dead prompt, not just a stray rule.

import { inputFenceState } from './input-fence-state.js';
import { statusBar } from './status-bar.js';

/** Force the fence down whatever the depth, keeping the buffer. */
export function resetInputFence(): void {
  inputFenceState.depth = 0;
  if (inputFenceState.stop !== null) {
    inputFenceState.pending = inputFenceState.stop();
    inputFenceState.stop = null;
  }
  statusBar.hideInputFence();
}
