// The batch-level UI seam runBatch reports through (V3/05). Split out of run.ts.
//
// Named for the type it builds, exactly as build-task-loop-reporter.ts is. The arrows inside are the
// returned handle's implementation, not declarations of their own.
//
// Same dependency inversion as the per-task seam: runBatch drives the ids sequentially and never
// imports a renderer.

import type { BatchReporter } from '../../core/session/index.js';
import { renderer } from '../../core/ui/renderer.js';
import { renderBatchSummary } from '../render-batch-summary.js';
import { renderTaskOutcome } from './render-task-outcome.js';

/** The batch-level UI seam (V3/05): per-task start/skip lines, each outcome, and the end-of-batch table. */
export function buildBatchReporter(): BatchReporter {
  return {
    taskStarted: (position, task) =>
      renderer.systemMessage(`▶ [${position.index}/${position.total}] ${task.id}: ${task.title}`),
    taskSkipped: (taskId, reason) => renderer.systemMessage(`Skipping ${taskId}: ${reason}`),
    // renderTaskOutcome: the same four-branch outcome line the single-task path prints, so a batch row
    // and a lone /run can never describe the same result differently.
    taskOutcome: (result) => renderTaskOutcome(result),
    // renderBatchSummary: the counts table, the queues the user must act on, and the exact token total.
    finished: (summary) => renderBatchSummary(summary),
  };
}
