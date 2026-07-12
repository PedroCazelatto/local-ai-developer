// Live activity state for the status line (V5/03): which tool is executing right now (name + start
// time), whether a model turn is in flight, and when the last tool call ended — so the status line
// can show a live elapsed timer while a tool runs (`running run_in_project (3.2s)`) and a growing
// stall indicator while the model is thinking with no tool firing. The turn loop (turn-loop.ts) is
// the sole writer (turnStarted/turnEnded around a turn, toolStarted/toolEnded around each dispatch);
// the REPL's status renderer reads label() on a timer.
//
// A cohesive tiny state machine (like status-bar.ts): one module, one job. These are UI-only display
// values — the constitution forbids them feeding any VRAM-safety / summarization decision (that is
// the exact Ollama token count's job, never a wall-clock timer).

/** The tool currently executing, or null when none is (between turns, or while the model streams). */
let currentTool: string | null = null;
/** Epoch ms when the current tool started — the elapsed timer counts up from here. */
let toolStartedAt = 0;
/** True while a model turn is streaming/dispatching — gates the "thinking / since last tool" field. */
let turnActive = false;
/** Whether a tool has fired in THIS turn (reset per turn) — flips the stall label's wording. */
let toolFiredThisTurn = false;
/** The stall timer's baseline: the turn's start, or the last tool's end — whichever is more recent. */
let lastActivityAt = 0;

/** One decimal second from a millisecond delta, floored at zero (never shows a negative on clock skew). */
function seconds(deltaMs: number): string {
  return (Math.max(0, deltaMs) / 1000).toFixed(1);
}

/** A model turn began: arm the stall timer and clear the per-turn tool flag. */
export function turnStarted(): void {
  turnActive = true;
  toolFiredThisTurn = false;
  lastActivityAt = Date.now();
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
  toolFiredThisTurn = true;
}

/** The current tool call returned: clear it and re-baseline the stall timer to now. */
export function toolEnded(): void {
  currentTool = null;
  lastActivityAt = Date.now();
}

/** Clear all activity state — the REPL calls this after each command/turn so idle shows no field. */
export function reset(): void {
  currentTool = null;
  turnActive = false;
  toolFiredThisTurn = false;
  toolStartedAt = 0;
  lastActivityAt = 0;
}

/**
 * The activity field for the status line, or null when idle (no turn, no tool) so the caller omits it:
 * - a tool running  → `running <tool> (X.Xs)` (elapsed since it started)
 * - thinking, a tool already fired this turn → `X.Xs since last tool` (a visible stall indicator)
 * - thinking, no tool yet this turn → `thinking (X.Xs)` (elapsed since the turn started)
 */
export function label(now: number = Date.now()): string | null {
  if (currentTool !== null) {
    return `running ${currentTool} (${seconds(now - toolStartedAt)}s)`;
  }
  if (turnActive) {
    const elapsed = seconds(now - lastActivityAt);
    return toolFiredThisTurn ? `${elapsed}s since last tool` : `thinking (${elapsed}s)`;
  }
  return null;
}
