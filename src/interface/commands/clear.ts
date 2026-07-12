// /clear (V4/04) — wipe ONLY the active phase's history, no confirmation (the user owns the decision
// to clear — CLAUDE.md). Nothing is destroyed: clearActivePhase MOVES `<phase>.jsonl` into archive/
// and resets the in-RAM view, so /resume can restore it. Other phases are untouched. A user command,
// never a model tool — hence it lives here in interface/commands/, not in src/tools/.

import type { ClearResult } from '../../core/session/index.js';
import * as renderer from '../../core/ui/renderer.js';

/** The slice of the orchestrator /clear needs — satisfied structurally by SessionOrchestrator. */
export interface ClearOrchestrator {
  readonly activePhase: string;
  // clearActivePhase: archive the active phase's JSONL, reset it in-RAM; returns the archive (or null).
  clearActivePhase(): ClearResult;
}

/** Phase ids are lowercase in-code; display them Titlecased to match the task's `<Phase>` wording. */
function titleCase(phase: string): string {
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}

export function clearCommand(orch: ClearOrchestrator): void {
  const { phase, archived } = orch.clearActivePhase();
  const name = titleCase(phase);
  // Report faithfully: an empty phase had no file to archive, so don't claim one was made.
  if (archived === null) {
    renderer.systemMessage(`Cleared ${name} (was empty — nothing to archive).`);
    return;
  }
  renderer.systemMessage(`Cleared ${name} · archived (use /resume to restore)`);
}
