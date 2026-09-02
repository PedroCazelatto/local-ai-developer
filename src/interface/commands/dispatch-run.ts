// /run's selector → path fork: a single task runs one loop directly, a batch runs unattended through
// runBatch. Split out of run.ts.
//
// This is the one place the fork is decided, and the ONLY place the project runs SEQUENTIALLY is
// stated as code rather than prose — there is no parallel branch to take (docs/product.md).

import { BacklogError, readBacklog, runBatch } from '../../core/session/index.js';
import type { Backlog, BatchDeps } from '../../core/session/index.js';
import { renderer } from '../../core/ui/renderer.js';
import { buildBatchReporter } from './build-batch-reporter.js';
import { buildSpecSlice } from './build-spec-slice.js';
import { buildTaskLoopReporter } from './build-task-loop-reporter.js';
import { resolveSelector } from './resolve-selector.js';
import type { RunOrchestrator } from './run-orchestrator.type.js';
import { runSingleTask } from './run-single-task.js';

/** Resolve the selector, then run either one task directly or the whole batch unattended. */
export async function dispatchRun(args: readonly string[], orch: RunOrchestrator): Promise<void> {
  const selector = args[0] ?? 'next';

  let backlog: Backlog;
  try {
    backlog = readBacklog(orch.projectPath);
  } catch (err) {
    renderer.errorLine(err instanceof BacklogError ? err.message : String(err));
    return;
  }

  // resolveSelector: the ordered ids to attempt, and whether this is an unattended batch.
  const selection = resolveSelector(backlog, selector);
  if (selection.ids.length === 0) {
    renderer.systemMessage(
      selector === 'next' || selector === 'all'
        ? 'No runnable tasks (all done, or blocked by unmet dependencies).'
        : `No tasks matched selector '${selector}'.`,
    );
    return;
  }

  if (!selection.isBatch) {
    // runSingleTask: guards eligibility and the dirty tree, runs the loop, stashes what did not pass.
    await runSingleTask(orch, selection.ids[0] ?? '');
    return;
  }

  // Unattended batch (V3/05): runBatch walks the ids sequentially, queuing escalations/blockers without
  // aborting, and prints + persists the summary. The runTask seam wraps runTaskLoop with the Worker's
  // spec slice + a position-aware reporter, so the core driver never imports a renderer (dependency
  // inversion). Per-task eligibility, dirty-tree guarding, and stashing live inside runBatch.
  const deps: BatchDeps = {
    projectPath: orch.projectPath,
    runTask: (task, position) => orch.runTaskLoop(task, buildSpecSlice(orch.projectPath, task), buildTaskLoopReporter(task, position)),
    // The same signal the fence arms from a `/stop` line — the batch reads it between tasks.
    stop: orch.runStop,
  };
  // buildBatchReporter: the batch-level UI seam — start/skip lines, each outcome, the summary table.
  await runBatch(deps, selection.ids, buildBatchReporter());
}
