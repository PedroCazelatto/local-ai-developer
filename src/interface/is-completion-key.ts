// Which key the REPL's Tab completion answers to — asked once per keystroke, before anything else runs.

import type { Key } from 'node:readline';

/**
 * True for a PLAIN forward Tab, the only key completion answers to. Shift+Tab is excluded on purpose —
 * it is unbound, not a reverse cycle and no longer the phase-cycle it once was — and so are Ctrl/Alt+Tab,
 * which belong to the terminal and the window manager.
 */
export function isCompletionKey(key: Key | undefined): boolean {
  return key !== undefined && key.name === 'tab' && key.shift !== true && key.ctrl !== true && key.meta !== true;
}
