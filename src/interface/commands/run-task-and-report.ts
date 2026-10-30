// Run ONE already-eligible task through the V3/01 fix loop and report the result. Split out of run.ts,
// where it was the private `runOneTask`.
//
// Renamed rather than carried across, because `runOneTask` and `runSingle` sat one concept apart in
// the same file and would have become two neighbouring files a reader has to open to tell apart. This
// one is the inner step — loop, then render; run-single-task.ts is the guarded selector path that
// calls it, and the name now says which is which.

import type { TaskLoopResult } from '../../core/session/run-task-loop.js';
import type { Task } from '../../core/session/task.type.js';
import { errMessage } from '../../core/err-message.js'; // an Error's message, or the thrown value stringified
import { renderer } from '../../core/ui/renderer.js';
import { buildSpecSlice } from './build-spec-slice.js';
import { buildTaskLoopReporter } from './build-task-loop-reporter.js';
import { renderTaskOutcome } from './render-task-outcome.js';
import type { RunOrchestrator } from './run-orchestrator.type.js';

/** Run one already-eligible task through the V3/01 fix loop, render its outcome, and return it (or null on error). */
export async function runTaskAndReport(orch: RunOrchestrator, task: Task): Promise<TaskLoopResult | null> {
  // buildSpecSlice: the Worker's focused context — its level docs + the Architecture excerpt.
  const specSlice = buildSpecSlice(orch.projectPath, task);
  let result: TaskLoopResult;
  try {
    // runTaskLoop: persistent Worker across ≤5 rounds, fresh Reviewer each round which commits what it accepts.
    // buildTaskLoopReporter: the injected per-round UI seam.
    result = await orch.runTaskLoop(task, specSlice, buildTaskLoopReporter(task));
  } catch (err) {
    renderer.errorLine(`Task loop failed on ${task.id}: ${errMessage(err)}. Left uncommitted.`);
    return null;
  }
  // renderTaskOutcome: passed / blocked / stopped / escalated, with what is already committed.
  renderTaskOutcome(result);
  return result;
}
