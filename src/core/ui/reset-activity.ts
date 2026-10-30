// Clear all activity state — the REPL calls this after each command/turn so idle shows nothing, and
// so a turn that threw between toolStarted and toolEnded cannot strand a tool name on the line.

import { statusActivityState } from './status-activity-state.js';

/** Clear all activity state — the REPL calls this after each command/turn so idle shows nothing. */
export function resetActivity(): void {
  statusActivityState.currentTool = null;
  statusActivityState.turnActive = false;
  statusActivityState.toolStartedAt = 0;
  statusActivityState.turnStartedAt = 0;
}
