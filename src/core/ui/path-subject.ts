// A tool-call subject that is a filesystem path — the one kind the `→` line never truncates, because
// a path's tail is where its meaning is and a cut path is worse than a wrapped row.

import { cleanSubjectText } from './clean-subject-text.js';
import { NO_SUBJECT } from './no-subject.js';
import type { ToolCallSubject } from './tool-call-subject.js';

/** A subject that must survive at full length whatever the terminal width is. */
export function pathSubject(value: unknown): ToolCallSubject {
  // cleanSubjectText: the model's value folded to one row and stripped of control characters.
  const path = cleanSubjectText(value);
  return path === '' ? NO_SUBJECT : { text: path, isPath: true };
}
