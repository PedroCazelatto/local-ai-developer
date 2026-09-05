// The activity line's current content: a spinner frame plus whatever the turn is doing.
//
// A bare `working` when the activity state is idle — the line is only ever drawn while the model is
// busy, so "no label" means "busy at something unlabelled", not "nothing is happening".

import { activityLineState } from './activity-line-state.js';
import { statusActivity } from './status-activity.js';
import { theme } from './theme.js';

/** Braille spinner frames (the classic ora 'dots' set). */
const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const;

/** The current line: a spinner frame + the activity label (a bare `working` if the state is idle). */
export function activityLineText(): string {
  // statusActivity.label: `running <tool> (X.Xs)` / `thinking (X.Xs)` / null when idle.
  const label = statusActivity.label() ?? 'working';
  return theme.meta(`${FRAMES[activityLineState.frame % FRAMES.length]} ${label}`);
}
