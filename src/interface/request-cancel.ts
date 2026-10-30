// What Ctrl+C means while a turn is running. Handed to the input fence by run-repl.ts, because the fence
// keeps no session knowledge of its own.

import { renderer } from '../core/ui/renderer.js';
import { theme } from '../core/ui/theme.js';
import type { ReplOrchestrator } from './run-repl.js';

/**
 * Ctrl+C mid-turn. Claims the press when there was something to stop, and says so in the scrollback —
 * a turn that simply stopped producing text, with no line explaining why, is indistinguishable from a
 * turn that died. The line also states the second half of the keymap, because the escape hatch changing
 * shape is exactly the thing a user needs told at the moment they reach for it.
 *
 * Returns false when nothing was generating and nothing was already armed, which lets the key fall
 * through to readline and end the session as it always has.
 */
export function requestCancel(orch: ReplOrchestrator): boolean {
  if (!orch.cancelActiveTurn()) return false;
  renderer.interjectLine(theme.meta('⎋ stopping this turn — press Ctrl+C again to quit'));
  return true;
}
