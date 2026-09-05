// Whether the transient activity line is on the cursor row right now — asked by anything that must
// print through it (renderer.interjectLine lifts it, writes, and puts it back).

import { activityLineState } from './activity-line-state.js';

/** Whether the line is on the cursor row right now — asked by anything that must print through it. */
export function isActivityLineVisible(): boolean {
  return activityLineState.visible;
}
