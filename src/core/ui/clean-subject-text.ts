// A model-supplied argument, made safe to print on the `→` tool-call line.
//
// Two hazards, both from the same source: the value is whatever the model sent. A multi-line string
// would break the one-row-per-call shape, and an embedded escape sequence could move the cursor or
// repaint the theme it is being printed in. A value that is not a string at all yields '' rather than
// a stringified object — the call then prints as its name alone, which is honest.

import { singleLine } from './single-line.js';
import { stripControlChars } from './strip-control-chars.js';

/** A model-supplied string, folded to one row and stripped of anything that could move the cursor. */
export function cleanSubjectText(value: unknown): string {
  return typeof value === 'string' ? stripControlChars(singleLine(value)).trim() : '';
}
