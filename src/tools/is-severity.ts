// Narrow an untyped submitted value to a review Severity.
//
// It validates against the runtime list rather than a literal union of its own, so the guard and the
// message that names the legal values back to the model can never disagree about what they are.

import type { Severity } from '../core/session/severity.type.js';
import { SEVERITIES } from '../core/session/severities.js';

/** True when `value` is one of the review severities (blocker / major / minor). */
export function isSeverity(value: unknown): value is Severity {
  return typeof value === 'string' && (SEVERITIES as readonly string[]).includes(value);
}
