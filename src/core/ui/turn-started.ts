// A model turn began: arm the thinking timer the activity line counts up from.

import { statusActivityState } from './status-activity-state.js';

/** A model turn began: arm the thinking timer. */
export function turnStarted(): void {
  statusActivityState.turnActive = true;
  statusActivityState.turnStartedAt = Date.now();
}
