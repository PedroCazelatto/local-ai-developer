// Is this parsed JSON value a real number? Split out of read-batch-summary-file.ts, where it was
// private and called `isCount` — a name that claimed a domain (a count is non-negative and whole) the
// body never checks.
//
// NaN and Infinity are JSON-impossible but `JSON.parse` will hand back whatever a hand-edited file
// holds, so the finiteness test is not redundant.

/** A parsed JSON value that is a finite number. */
export function isFiniteNumber(raw: unknown): raw is number {
  return typeof raw === 'number' && Number.isFinite(raw);
}
