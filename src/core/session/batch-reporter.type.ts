// Where the batch sends its progress. Injected so the driver prints nothing itself.

import type { BatchPosition } from './batch-position.type.js';
import type { TaskLoopResult } from './run-task-loop.js';
import type { BatchSummary } from './batch-summary.type.js';
import type { Task } from './task.type.js';

/** UI seam the batch reports progress through (the interface supplies the rendering). */
export interface BatchReporter {
  /** A task is about to run (its position among the candidates). */
  taskStarted(position: BatchPosition, task: Task): void;
  /** A candidate was skipped before running, with why. */
  taskSkipped(taskId: string, reason: string): void;
  /** One task's terminal loop outcome (passed / escalated / blocked). */
  taskOutcome(result: TaskLoopResult): void;
  /** The batch finished (or aborted) — render the end-of-batch summary table. */
  finished(summary: BatchSummary): void;
}
