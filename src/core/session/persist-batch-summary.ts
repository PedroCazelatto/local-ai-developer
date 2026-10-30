// Write the batch summary as pretty JSON under .orchestrator/batches/. Pretty rather than compact
// because a human reads it the morning after, and the file is the only record of what the run did.
//
// Named persistBatchSummary rather than the module-private `persistSummary` it was extracted from.

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { batchSummaryFileName } from './batch-summary-file-name.js';
import { BATCHES_DIRNAME } from './batches-dirname.js';
import type { BatchSummary } from './batch-summary.type.js';

/** Write the summary as pretty JSON under .orchestrator/batches/ so the morning-after report survives the REPL. */
export function persistBatchSummary(projectPath: string, summary: BatchSummary): void {
  const dir = path.join(projectPath, '.orchestrator', BATCHES_DIRNAME);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, batchSummaryFileName(summary)), `${JSON.stringify(summary, null, 2)}\n`, 'utf-8');
}
