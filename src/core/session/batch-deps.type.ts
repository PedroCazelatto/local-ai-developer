// What the batch driver needs, injected rather than imported (dependency inversion).

import type { BatchPosition } from './batch-position.type.js';
import type { RunStopSignal } from './run-stop-signal.js';
import type { TaskLoopResult } from './run-task-loop.type.js';
import type { Task } from './task.type.js';

/**
 * What the batch driver binds to: the project root + the seam that runs ONE task's loop. The seam is
 * supplied by the interface layer (it wraps orch.runTaskLoop with the Worker spec slice + a per-task
 * reporter), so the core driver never imports a concrete renderer (dependency inversion).
 */
export interface BatchDeps {
  readonly projectPath: string;
  // runTask: run ONE eligible task through the V3/01 implement→test→review→fix loop; the Reviewer commits.
  runTask(task: Task, position: BatchPosition): Promise<TaskLoopResult>;
  /** The `/stop` wind-down request, read between tasks. See run-stop-signal.ts. */
  readonly stop: RunStopSignal;
}
