// One `cancelled` row of a persisted batch summary. Split out of read-batch-summary-file.ts.

import type { BatchCancelled } from '../../core/session/index.js';
import { isFiniteNumber } from './is-finite-number.js';
import { isString } from './is-string.js';
import { readBatchCommits } from './read-batch-commits.js'; // the row's short SHAs, oldest first

/** A task the user stopped: why it stopped, and what the Reviewer had already accepted. */
export function readBatchCancelled(row: Record<string, unknown>): BatchCancelled | undefined {
  const commits = readBatchCommits(row['commits']);
  const stashRef = row['stashRef'];
  if (!isString(row['taskId']) || !isFiniteNumber(row['rounds']) || !isString(row['reason'])) return undefined;
  if (commits === undefined || !(stashRef === null || isString(stashRef))) return undefined;
  return { taskId: row['taskId'], rounds: row['rounds'], reason: row['reason'], commits, stashRef };
}
