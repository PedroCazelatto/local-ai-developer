// Narrow a parsed JSON value back to the BatchSummary the end-of-batch renderer prints. Split out of
// read-batch-summary-file.ts.

import type { BatchSummary } from '../../core/session/batch-summary.type.js';
import { isFiniteNumber } from './is-finite-number.js';
import { isRecord } from '../../core/llm/is-record.js'; // a non-null, non-array object (never null, never an array)
import { isString } from './is-string.js';
import { readBatchBlocked } from './read-batch-blocked.js';
import { readBatchBucket } from './read-batch-bucket.js'; // narrow every element, or fail the summary
import { readBatchCancelled } from './read-batch-cancelled.js';
import { readBatchEscalated } from './read-batch-escalated.js';
import { readBatchPassed } from './read-batch-passed.js';
import { readBatchSkipped } from './read-batch-skipped.js';
import { readBatchTokens } from './read-batch-tokens.js'; // the exact prompt/eval totals, nulls kept

/** Narrow a parsed JSON value to a BatchSummary, or undefined when it is not one this build can render. */
export function toBatchSummary(value: unknown): BatchSummary | undefined {
  if (!isRecord(value)) return undefined;
  const passed = readBatchBucket(value['passed'], readBatchPassed);
  const escalated = readBatchBucket(value['escalated'], readBatchEscalated);
  const blocked = readBatchBucket(value['blocked'], readBatchBlocked);
  const cancelled = readBatchBucket(value['cancelled'], readBatchCancelled);
  const skipped = readBatchBucket(value['skipped'], readBatchSkipped);
  const tokens = readBatchTokens(value['tokens']);
  if (!isFiniteNumber(value['seq']) || !isFiniteNumber(value['total'])) return undefined;
  if (!isString(value['startedAt']) || !isString(value['finishedAt'])) return undefined;
  if (passed === undefined || escalated === undefined || blocked === undefined) return undefined;
  if (cancelled === undefined || skipped === undefined || tokens === undefined) return undefined;

  const abortedReason = value['abortedReason'];
  const stoppedReason = value['stoppedReason'];
  return {
    seq: value['seq'],
    startedAt: value['startedAt'],
    finishedAt: value['finishedAt'],
    total: value['total'],
    passed,
    escalated,
    blocked,
    cancelled,
    skipped,
    tokens,
    // Both are optional on the wire and are only present when they happened — carried through as
    // absent rather than as an empty string, so the renderer's "did this happen" check still holds.
    ...(isString(abortedReason) ? { abortedReason } : {}),
    ...(isString(stoppedReason) ? { stoppedReason } : {}),
  };
}
