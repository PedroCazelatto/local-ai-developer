// One Tab press, end to end: work out the edit (cycle-completion.ts), land it in readline's buffer
// (replace-input-line.ts), and hand back the cycle the next press continues.

import type { Interface as ReadlineInterface } from 'node:readline/promises';

import type { CompletionCycle } from './completion-cycle.type.js';
import { cycleCompletion } from './cycle-completion.js';
import { replaceInputLine } from './replace-input-line.js';
import type { ReplOrchestrator } from './run-repl.js';

/**
 * One Tab press, returning the cycle to carry into the next one (null when there was nothing to
 * complete: a chat line, an unknown command, or an argument position offering no candidates).
 *
 * cycleCompletion: swaps the word under the cursor for the next candidate, wrapping after the last —
 * so Tab never prints anything and the pinned rows are never disturbed by a candidate list. It is
 * SYNCHRONOUS by contract, which is the constraint the whole feature is shaped around: this runs inline
 * in the keypress handler while the pinned rows are repainted from a setImmediate scheduled by that same
 * handler, so an awaited lookup would resolve after the repaint and leave those rows blank.
 */
export function completeAtCursor(
  orch: ReplOrchestrator,
  rl: ReadlineInterface,
  active: CompletionCycle | null,
): CompletionCycle | null {
  const step = cycleCompletion({ line: rl.line, cursor: rl.cursor, orch, active });
  if (step === null) return null;
  replaceInputLine(rl, step.line, step.cursor); // write readline's own buffer + a cursor-preserving refresh
  return step.cycle;
}
