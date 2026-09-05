// Take what was typed during the turns, clearing it — the REPL writes it into the next prompt, so the
// box opens where the user left off with full readline editing back.

import { inputFenceState } from './input-fence-state.js';

/** Take what was typed during the turns, clearing it — the REPL writes it into the next prompt. */
export function drainTypedAhead(): string {
  const typed = inputFenceState.pending;
  inputFenceState.pending = '';
  return typed;
}
