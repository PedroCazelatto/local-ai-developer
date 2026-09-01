// One `skipped` row of a persisted batch summary. Split out of read-batch-summary-file.ts.

import type { BatchSkipped } from '../../core/session/index.js';
import { isString } from './is-string.js';

/** A task the batch never attempted: its id and the reason it was passed over. */
export function readBatchSkipped(row: Record<string, unknown>): BatchSkipped | undefined {
  if (!isString(row['taskId']) || !isString(row['reason'])) return undefined;
  return { taskId: row['taskId'], reason: row['reason'] };
}
