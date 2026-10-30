// The turn ended (or threw): stop the thinking field and drop any lingering current-tool, so a turn
// that died mid-dispatch cannot leave the activity line claiming a tool is still running.

import { statusActivityState } from './status-activity-state.js';

/** The turn ended (or threw): stop the thinking field and drop any lingering current-tool. */
export function turnEnded(): void {
  statusActivityState.turnActive = false;
  statusActivityState.currentTool = null;
}
