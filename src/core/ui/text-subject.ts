// A tool-call subject that is prose or a short structural field — anything but a path, and therefore
// truncatable to fit the `→` line.

import { NO_SUBJECT } from './no-subject.js';
import type { ToolCallSubject } from './tool-call-subject.js';

/** A subject that may be truncated to fit the row. Already cleaned by the caller. */
export function textSubject(value: string): ToolCallSubject {
  return value === '' ? NO_SUBJECT : { text: value, isPath: false };
}
