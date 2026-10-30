// Validate ONE entry of a submit_verdict `issues` array into a ReviewIssue.
//
// It is `parseReviewIssue` rather than `parseIssue`: as a file name in a flat directory `parse-issue`
// gives no clue which kind of issue, and the type it produces is named ReviewIssue.
//
// Strict on purpose -- everything downstream trusts the shape -- with one deliberate exception:
// `file` is optional in spirit ("" when the finding is not file-specific), so a missing or
// wrong-typed one is coerced rather than refused. A missing severity or an empty note is not.

import type { ReviewIssue } from '../core/session/review-issue.type.js';
import { SEVERITIES } from '../core/session/severities.js';
// A string quoted, anything else stringified — so a trailing space in the value is visible.
import { describeValue } from './describe-value.js';
import { isSeverity } from './is-severity.js';
// The `{ ok: false, error }` branch every parser in this directory shares.
import { parseFailure } from './parse-failure.js';

/** Validate one entry of the `issues` array into a ReviewIssue, or the reason it is not one. */
export function parseReviewIssue(raw: unknown, index: number): { ok: true; issue: ReviewIssue } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return parseFailure(`issues[${index}] must be an object with severity, file, and note.`);
  }
  const record = raw as Record<string, unknown>;
  if (!isSeverity(record['severity'])) {
    return parseFailure(`issues[${index}].severity must be one of ${SEVERITIES.join(', ')} (got ${describeValue(record['severity'])}).`);
  }
  const note = record['note'];
  if (typeof note !== 'string' || note.trim() === '') {
    return parseFailure(`issues[${index}].note must be a non-empty, actionable string.`);
  }
  // file is optional-in-spirit: "" when not file-specific. Coerce a missing/non-string to "".
  const file = typeof record['file'] === 'string' ? record['file'] : '';
  return { ok: true, issue: { severity: record['severity'], file, note: note.trim() } };
}
