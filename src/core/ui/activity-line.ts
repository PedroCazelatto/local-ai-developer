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

import { stdout } from 'node:process';

import * as statusActivity from './status-activity.js';
import { theme } from './theme.js';

/** Braille spinner frames (the classic ora 'dots' set). */
const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const;

/** True while the activity line occupies the current cursor row. */
let visible = false;
/** Current spinner frame index, advanced on each repaint. */
let frame = 0;

/** The current line: a spinner frame + the activity label (a bare `working` if the state is idle). */
function lineText(): string {
  const label = statusActivity.label() ?? 'working';
  return theme.meta(`${FRAMES[frame % FRAMES.length]} ${label}`);
}

/** Draw the activity line at the cursor. Idempotent (a second show() is a no-op). TTY only. */
export function show(): void {
  if (visible || !stdout.isTTY) return;
  visible = true;
  stdout.write(lineText());
}

/** Whether the line is on the cursor row right now — asked by anything that must print through it. */
export function isVisible(): boolean {
  return visible;
}

/** Advance the spinner and repaint the line in place. No-op when hidden; called on the REPL ticker. */
export function repaint(): void {
  if (!visible || !stdout.isTTY) return;
  frame += 1;
  stdout.write(`\r\x1b[2K${lineText()}`); // carriage return, clear the row, redraw (never ESC[0J)
}

/** Erase the line, leaving the cursor at column 1 of its (now blank) row so the next output reuses it. */
export function hide(): void {
  if (!visible) return;
  visible = false;
  if (stdout.isTTY) stdout.write('\r\x1b[2K');
}
