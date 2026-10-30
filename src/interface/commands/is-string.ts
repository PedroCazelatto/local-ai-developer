// Is this parsed JSON value a string? Split out of read-batch-summary-file.ts, where it was private
// and called `isText`. Deliberately NOT non-empty-text.ts's test: this one accepts the empty string,
// because a persisted `lastFeedback` or `reason` may legitimately be empty and rejecting it would
// fail the whole summary.

/** A parsed JSON value that is a string — the empty string included. */
export function isString(raw: unknown): raw is string {
  return typeof raw === 'string';
}
