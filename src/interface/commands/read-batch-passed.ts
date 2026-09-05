// One `passed` row of a persisted batch summary. Split out of read-batch-summary-file.ts.

import type { BatchPassed } from '../../core/session/batch-passed.type.js';
import { isFiniteNumber } from './is-finite-number.js';
import { isString } from './is-string.js';
import { readBatchCommits } from './read-batch-commits.js'; // the row's short SHAs, oldest first

/** A task the Reviewer passed: its id, what was committed for it, and how many rounds it took. */
export function readBatchPassed(row: Record<string, unknown>): BatchPassed | undefined {
  const commits = readBatchCommits(row['commits']);
  if (!isString(row['taskId']) || commits === undefined || !isFiniteNumber(row['rounds'])) return undefined;
  return { taskId: row['taskId'], commits, rounds: row['rounds'] };
}
