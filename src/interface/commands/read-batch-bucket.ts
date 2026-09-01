// One of a persisted batch summary's five outcome buckets (passed / escalated / blocked / cancelled /
// skipped), narrowed element by element. Split out of read-batch-summary-file.ts.

import { isRecord } from '../../core/llm/is-record.js'; // a non-null, non-array object (never null, never an array)

/** Narrow each element of a persisted bucket, failing the whole summary if any element does not. */
export function readBatchBucket<T>(
  raw: unknown,
  readOne: (row: Record<string, unknown>) => T | undefined,
): T[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: T[] = [];
  for (const element of raw) {
    if (!isRecord(element)) return undefined;
    const one = readOne(element);
    if (one === undefined) return undefined;
    out.push(one);
  }
  return out;
}
