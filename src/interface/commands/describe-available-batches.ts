// Name the batch numbers that ARE on disk, for the line /batch prints when the one asked for is not.
// Answering the follow-up question in the same breath is why there is no `/batch list` to learn first.
//
// Split out of batch.ts, where it was the private `describeAvailable` — a name that said nothing
// about what was available once it became a file name a stranger reads before the function.

import type { BatchFile } from './list-batch-files.js';

/** `#4` for one file, `#1–#7` for a range; `none` when there is nothing on disk to name. */
export function describeAvailableBatches(files: readonly BatchFile[]): string {
  const first = files[0];
  const last = files[files.length - 1];
  if (first === undefined || last === undefined) return 'none';
  return first.seq === last.seq ? `#${first.seq}` : `#${first.seq}–#${last.seq}`;
}
