// What the transient activity line says right now — or nothing, when nothing is happening.
//
// There is deliberately NO "since last tool" variant: the timer only ever reports thinking-or-tool
// elapsed, never time since the last tool call returned.

import { elapsedSeconds } from './elapsed-seconds.js';
import { statusActivityState } from './status-activity-state.js';

/**
 * The activity label, or null when idle (no turn, no tool) so the caller shows nothing:
 * - a tool running       → `running <tool> (X.Xs)` (elapsed since it started)
 * - thinking, no tool    → `thinking (X.Xs)` (elapsed since the turn started)
 */
export function activityLabel(now: number = Date.now()): string | null {
  const { currentTool, toolStartedAt, turnActive, turnStartedAt } = statusActivityState;
  // elapsedSeconds: one decimal second from a ms delta, floored at zero.
  if (currentTool !== null) return `running ${currentTool} (${elapsedSeconds(now - toolStartedAt)}s)`;
  if (turnActive) return `thinking (${elapsedSeconds(now - turnStartedAt)}s)`;
  return null;
}
