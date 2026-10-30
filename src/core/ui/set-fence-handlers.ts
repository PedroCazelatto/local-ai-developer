// Wire the input fence to the session (called once, by the REPL).
//
// `control` gets every submitted line first and returns true when it claimed it; `cancel` gets every
// mid-turn Ctrl+C and returns true when it stopped something. Keeping both as injected callbacks is
// what lets the fence stay pure UI — it never learns what a turn or a batch is.

import { inputFenceState } from './input-fence-state.js';

/** Register the REPL's control-line and cancel handlers with the fence. */
export function setFenceHandlers(handlers: { control(line: string): boolean; cancel(): boolean }): void {
  inputFenceState.controlHandler = handlers.control;
  inputFenceState.cancelHandler = handlers.cancel;
}
