// Types for run-stop-signal.ts (constitution: types live in a sibling file, never inline).

/**
 * How far a wind-down lets the work in flight run before it stops.
 *
 * - `round` — finish the round the Worker/Reviewer are in, then stop. The task ends without a verdict.
 * - `task`  — finish the whole task (through its verdict, commits and all), then stop before the next
 *             one. This is the setting an overnight batch wants: nothing already earned is discarded.
 *
 * There is no `now`: stopping instantly is what cancelling is for, and it is a different key.
 */
export type StopScope = 'round' | 'task';
