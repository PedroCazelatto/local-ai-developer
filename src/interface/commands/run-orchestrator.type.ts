// The slice of the orchestrator /run needs. Its own module rather than a declaration inside one
// function's file because it has no single owner: run-task-and-report.ts, run-single-task.ts,
// dispatch-run.ts and run-with-stop-armed.ts all take it, co-equally, and none of them is the one the
// others serve. The test is what would own it, not how many files import it.

import type { RunStopSignal } from '../../core/session/run-stop-signal.js';
import type { TaskLoopResult } from '../../core/session/run-task-loop.js';
import type { TaskLoopReporter } from '../../core/session/task-loop-reporter.type.js';
import type { Task } from '../../core/session/task.type.js';

/** The slice of the orchestrator /run needs — satisfied structurally by SessionOrchestrator. */
export interface RunOrchestrator {
  readonly project: string;
  readonly projectPath: string;
  // runTaskLoop: the V3/01 implement→test→review→fix controller for one task; the Reviewer commits.
  runTaskLoop(task: Task, specSlice: string, reporter: TaskLoopReporter): Promise<TaskLoopResult>;
  /** The `/stop` wind-down request — armed for the length of a run so the fence can claim `/stop`. */
  readonly runStop: RunStopSignal;
}
