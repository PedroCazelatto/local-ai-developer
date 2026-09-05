// The `commits` list of one persisted batch row. Split out of read-batch-summary-file.ts.

import { isString } from './is-string.js'; // a parsed JSON value that is a string

/** A persisted `commits` list: short SHAs, oldest first. Absent/!array fails the row it belongs to. */
export function readBatchCommits(raw: unknown): readonly string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.every(isString) ? raw : undefined;
}
