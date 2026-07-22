// Live activity state for the transient activity line (turn-loop is the sole writer; activity-line.ts
// reads it): which tool is executing right now (name + start time), and whether a model turn is
// thinking. The turn loop calls turnStarted/turnEnded around a turn and toolStarted/toolEnded around
// each dispatch; the activity line reads label() on a timer to show `thinking (X.Xs)` or
// `running <tool> (X.Xs)`.
//
// A cohesive tiny state machine (like status-bar.ts): one module, one job. These are UI-only display
// values — the constitution forbids them feeding any VRAM-safety / summarization decision (that is
// the exact Ollama token count's job, never a wall-clock timer).

/** The tool currently executing, or null when none is (between turns, or while the model streams). */
let currentTool: string | null = null;
/** Epoch ms when the current tool started — the elapsed timer counts up from here. */
let toolStartedAt = 0;
/** True while a model turn is in flight — gates the `thinking` field. */
let turnActive = false;
/** Epoch ms when the current turn started — the thinking timer counts up from here. */
let turnStartedAt = 0;

/** One decimal second from a millisecond delta, floored at zero (never shows a negative on clock skew). */
function seconds(deltaMs: number): string {
  return (Math.max(0, deltaMs) / 1000).toFixed(1);
}

/** A model turn began: arm the thinking timer. */
export function turnStarted(): void {
  turnActive = true;
  turnStartedAt = Date.now();
}

/** The turn ended (or threw): stop the thinking field and drop any lingering current-tool. */
export function turnEnded(): void {
  turnActive = false;
  currentTool = null;
}

/** A tool call started dispatching: show it with a live elapsed timer until toolEnded(). */
export function toolStarted(name: string): void {
  currentTool = name;
  toolStartedAt = Date.now();
}

/** The current tool call returned: clear it. */
export function toolEnded(): void {
  currentTool = null;
}

/** Clear all activity state — the REPL calls this after each command/turn so idle shows nothing. */
export function reset(): void {
  currentTool = null;
  turnActive = false;
  toolStartedAt = 0;
  turnStartedAt = 0;
}

/**
 * The activity label, or null when idle (no turn, no tool) so the caller shows nothing:
 * - a tool running       → `running <tool> (X.Xs)` (elapsed since it started)
 * - thinking, no tool    → `thinking (X.Xs)` (elapsed since the turn started)
 *
 * There is deliberately NO "since last tool" variant — the timer only ever reports thinking-or-tool
 * elapsed, never time since the last tool call returned.
 */
export function label(now: number = Date.now()): string | null {
  if (currentTool !== null) return `running ${currentTool} (${seconds(now - toolStartedAt)}s)`;
  if (turnActive) return `thinking (${seconds(now - turnStartedAt)}s)`;
  return null;
}
