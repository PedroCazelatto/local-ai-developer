// Ctrl+C mid-turn: let the session try to cancel it.
//
// False means "not mine" and the key falls through to readline, ending the session exactly as it
// always did — which is what keeps the escape hatch honest when there is nothing to cancel. Defaults
// to declining when no handler is registered.

import { inputFenceState } from './input-fence-state.js';

/** Ctrl+C mid-turn: true when the session claimed it as a cancel, false to let the key end the session. */
export function offerFenceCancel(): boolean {
  return inputFenceState.cancelHandler?.() === true;
}
