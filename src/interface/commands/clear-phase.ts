// The body of /clear: point the active phase at a new context and report the address that would
// bring the old one back. Split out of clear.ts, which is now the assembler that registers it.
//
// Named clearPhase, NOT clearActivePhase, and the distinction is load-bearing: that name already
// belongs to SessionOrchestrator's METHOD (session-orchestrator.ts:279, and the slice run-repl.ts
// declares), which does the work. This one calls that method and reports what came back — two
// different functions, and a shared name in a flat folder is how a reader opens the wrong one. It
// matches swap-phase.ts beside it, which likewise wraps a switch in one reported line.
//
// Nothing is destroyed: the context it sets aside keeps every turn it held and stays reopenable with
// /resume. The NEW context is not named, because it does not exist yet — a context row is created
// lazily on its first flush, and naming an id now would be inventing one.

import type { ClearResult } from '../../core/session/index.js';
import { shortContextId } from '../../core/session/index.js';
import { capitalizePhase } from '../../core/ui/capitalize-phase.js';
import { renderer } from '../../core/ui/renderer.js';

/** The slice of the orchestrator /clear needs — satisfied structurally by SessionOrchestrator. */
export interface ClearOrchestrator {
  readonly activePhase: string;
  // clearActivePhase: point the phase at a new context; returns the one set aside (null if it had none).
  clearActivePhase(): ClearResult;
}

/** Start the active phase on a new context, reporting the /resume address of the one set aside. */
export function clearPhase(orch: ClearOrchestrator): void {
  const { phase, cleared } = orch.clearActivePhase();
  // capitalizePhase: phase ids are lowercase in-code; display them Titlecased to match the task's
  // `<Phase>` wording.
  const name = capitalizePhase(phase);
  // Report faithfully: a phase that never produced an answer has no context to set aside, so don't
  // claim one is recoverable.
  if (cleared === null) {
    renderer.systemMessage(`Started a new ${name} context (the previous one was empty — nothing to reopen).`);
    return;
  }
  const address = `${phase}/${shortContextId(cleared.id)}`;
  const described = cleared.title === null ? address : `${address} "${cleared.title}"`;
  renderer.systemMessage(`Started a new ${name} context · /resume reopens ${described}`);
}
