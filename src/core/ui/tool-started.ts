// A tool call started dispatching: show it with a live elapsed timer until toolEnded().

import { statusActivityState } from './status-activity-state.js';

/** A tool call started dispatching: show it with a live elapsed timer until toolEnded(). */
export function toolStarted(name: string): void {
  statusActivityState.currentTool = name;
  statusActivityState.toolStartedAt = Date.now();
}
