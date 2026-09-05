// The persisted file name for one batch summary. The zero-padded sequence leads so a directory listing
// is in run order, and the timestamp follows so two runs can never collide.

import { compactTimestamp } from './compact-timestamp.js';
import type { BatchSummary } from './batch-summary.type.js';

/** The persisted file name for a summary: `<zero-padded seq>-<compact startedAt>.json` (Windows-safe). */
export function batchSummaryFileName(summary: Pick<BatchSummary, 'seq' | 'startedAt'>): string {
  return `${String(summary.seq).padStart(4, '0')}-${compactTimestamp(summary.startedAt)}.json`;
}
