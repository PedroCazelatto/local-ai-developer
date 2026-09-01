// One `escalated` row of a persisted batch summary. Split out of read-batch-summary-file.ts.

import type { BatchEscalated } from '../../core/session/index.js';
import { isFiniteNumber } from './is-finite-number.js';
import { isString } from './is-string.js';
import { readBatchCommits } from './read-batch-commits.js'; // the row's short SHAs, oldest first

/** A task that ran out of rounds without a pass: the last feedback, and where the rest was stashed. */
export function readBatchEscalated(row: Record<string, unknown>): BatchEscalated | undefined {
  const commits = readBatchCommits(row['commits']);
  const stashRef = row['stashRef'];
  if (!isString(row['taskId']) || !isFiniteNumber(row['rounds']) || !isString(row['lastFeedback'])) return undefined;
  if (commits === undefined || !(stashRef === null || isString(stashRef))) return undefined;
  return { taskId: row['taskId'], rounds: row['rounds'], lastFeedback: row['lastFeedback'], commits, stashRef };
}
