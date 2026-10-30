// One persisted token count, which may legitimately be null. Split out of read-batch-summary-file.ts,
// where it was private and called `readTokenCount`.
//
// Three-valued on purpose, and the name carries the invariant the way sql-int-or-null.ts's does:
// `null` means the model reported no metric for that batch and MUST stay null, while `undefined`
// means the field was not a number at all and fails the whole summary. Collapsing the two would
// invent a count, which the constitution forbids.

import { isFiniteNumber } from './is-finite-number.js'; // a parsed JSON value that is a finite number

/** `promptTokens` / `evalTokens` as persisted — a number, or a null that MUST stay null. */
export function nullableTokenCount(raw: unknown): number | null | undefined {
  if (raw === null) return null;
  return isFiniteNumber(raw) ? raw : undefined;
}
