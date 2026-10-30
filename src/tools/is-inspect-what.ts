// Narrow an untyped `what` argument to one of git_inspect's three read-only questions.
//
// It checks against the runtime list rather than a union of its own, so the guard and the message
// that names the legal values back to the model cannot drift apart. `isWhat` was adequate while it
// was private inside git-inspect.ts; as a file name it says nothing at all.

import type { InspectWhat } from './inspect-what.type.js';
import { INSPECT_WHATS } from './inspect-whats.js';

/** True when `value` is one of git_inspect's three actions. */
export function isInspectWhat(value: unknown): value is InspectWhat {
  return typeof value === 'string' && (INSPECT_WHATS as readonly string[]).includes(value);
}
