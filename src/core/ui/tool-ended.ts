// The current tool call returned: clear it, so the activity line falls back to `thinking` for the
// rest of the turn.

import { statusActivityState } from './status-activity-state.js';

/** The current tool call returned: clear it. */
export function toolEnded(): void {
  statusActivityState.currentTool = null;
}
