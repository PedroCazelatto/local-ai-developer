// The transient "activity line": while the model is busy but NOT streaming visible text (thinking, or
// running a tool), a single line under the cursor shows a spinner frame + the current activity
// (`⠹ thinking (3.2s)` / `⠹ running run_in_project (1.1s)`). It repaints IN PLACE on the REPL's ticker
// and erases itself on hide(), so it stays a transient widget — nothing it draws lands in the
// append-only scrollback (constitution, Terminal UX). Replaces the old ora spinner.
//
// stdout-only, and that is load-bearing: the old ora wrapper had to pass discardStdin:false because
// ora toggles the TTY raw mode / pauses stdin on stop, which desyncs the readline interface that owns
// stdin (after one turn the next rl.question gets no live stdin and the app exits). We never touch
// stdin here, so that whole hazard is gone.
//
// An ASSEMBLER: one function per file put the four operations in four files, and this composes them
// into the single object callers already used it as. It exports that object and nothing else. The
// state lives in activity-line-state.ts, which only these may write.

import { hideActivityLine } from './hide-activity-line.js';
import { isActivityLineVisible } from './is-activity-line-visible.js';
import { repaintActivityLine } from './repaint-activity-line.js';
import { showActivityLine } from './show-activity-line.js';

/** The transient spinner+activity line: draw it, ask whether it is up, tick it, erase it. */
export const activityLine = {
  show: showActivityLine,
  isVisible: isActivityLineVisible,
  repaint: repaintActivityLine,
  hide: hideActivityLine,
};
