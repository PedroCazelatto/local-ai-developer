// Live activity state for the transient activity line (turn-loop is the sole writer; activity-line.ts
// reads it): which tool is executing right now (name + start time), and whether a model turn is
// thinking. The turn loop calls turnStarted/turnEnded around a turn and toolStarted/toolEnded around
// each dispatch; the activity line reads label() on a timer to show `thinking (X.Xs)` or
// `running <tool> (X.Xs)`.
//
// A tiny state machine, one job. These are UI-only display values — the constitution forbids them
// feeding any VRAM-safety / summarization decision (that is the exact Ollama token count's job, never
// a wall-clock timer).
//
// An ASSEMBLER: one function per file put the six operations in six files, and this composes them
// into the single object callers already used it as. It exports that object and nothing else. The
// state lives in status-activity-state.ts, which only these may write.

import { activityLabel } from './activity-label.js';
import { resetActivity } from './reset-activity.js';
import { toolEnded } from './tool-ended.js';
import { toolStarted } from './tool-started.js';
import { turnEnded } from './turn-ended.js';
import { turnStarted } from './turn-started.js';

/** The turn/tool activity clock behind the transient activity line. */
export const statusActivity = {
  turnStarted,
  turnEnded,
  toolStarted,
  toolEnded,
  reset: resetActivity,
  label: activityLabel,
};
