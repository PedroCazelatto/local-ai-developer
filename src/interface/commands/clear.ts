// /clear — start the active phase on a NEW context, no confirmation (the user owns the decision to
// clear — CLAUDE.md). Nothing is destroyed: the context it sets aside keeps every turn it held and
// stays reopenable with /resume, so this command reports the address that would bring it back. Other
// phases are untouched. A user command, never a model tool — hence interface/commands/, not src/tools/.
//
// The new context is NOT named here, because it does not exist yet: a context row is created lazily on
// its first flush, which is the first time the model answers. Naming an id now would be inventing one.

import type { ClearResult } from '../../core/session/index.js';
import { shortContextId } from '../../core/session/index.js';
import { renderer } from '../../core/ui/renderer.js';
import type { Command } from '../command-registry.js';

/** The slice of the orchestrator /clear needs — satisfied structurally by SessionOrchestrator. */
export interface ClearOrchestrator {
  readonly activePhase: string;
  // clearActivePhase: point the phase at a new context; returns the one set aside (null if it had none).
  clearActivePhase(): ClearResult;
}

/** Phase ids are lowercase in-code; display them Titlecased to match the task's `<Phase>` wording. */
function titleCase(phase: string): string {
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}

function clearActivePhase(orch: ClearOrchestrator): void {
  const { phase, cleared } = orch.clearActivePhase();
  const name = titleCase(phase);
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

export const clearCommand: Command = {
  name: 'clear',
  group: 'session',
  description: "Start the active phase on a new context (the old one stays — /resume reopens it)",
  run: (ctx) => clearActivePhase(ctx.orch),
};
