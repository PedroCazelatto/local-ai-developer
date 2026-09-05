// One `blocked` row of a persisted batch summary. Split out of read-batch-summary-file.ts.

import type { BatchBlocked } from '../../core/session/index.js';
import { isString } from './is-string.js';
import { readBatchCommits } from './read-batch-commits.js'; // the row's short SHAs, oldest first

/** A task the Reviewer raised a blocker on: the question, its blocker id, and the stashed attempt. */
export function readBatchBlocked(row: Record<string, unknown>): BatchBlocked | undefined {
  const commits = readBatchCommits(row['commits']);
  const blockerId = row['blockerId'];
  const stashRef = row['stashRef'];
  if (!isString(row['taskId']) || !isString(row['question']) || commits === undefined) return undefined;
  if (!(blockerId === null || isString(blockerId)) || !(stashRef === null || isString(stashRef))) return undefined;
  return { taskId: row['taskId'], blockerId, question: row['question'], commits, stashRef };
}
