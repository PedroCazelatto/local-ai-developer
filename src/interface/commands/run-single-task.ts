// The `next` / single-id path of /run: guard, run, then stash whatever did not pass. Split out of
// run.ts, where it was the private `runSingle`.
//
// Per-task eligibility, dirty-tree guarding and stashing live HERE for the single path and inside
// runBatch for the unattended one — deliberately, because the batch has to queue what this path
// halts on.

import { findTask } from '../../core/session/find-task.js';
import { isWorkingTreeDirty } from '../../core/session/is-working-tree-dirty.js';
import { readBacklog } from '../../core/session/read-backlog.js';
import { stashTaskAttempt } from '../../core/session/stash-task-attempt.js';
import { taskSkipReason } from '../../core/session/task-skip-reason.js';
import { renderer } from '../../core/ui/renderer.js';
import type { RunOrchestrator } from './run-orchestrator.type.js';
import { runTaskAndReport } from './run-task-and-report.js';

/** Why /run refuses to start a task while the project tree has uncommitted changes. */
const HALT_DIRTY =
  'the project working tree has uncommitted changes, so its review can\'t be isolated. Commit or stash ' +
  'them first (right after /new-project, commit the scaffold + backlog + PRODUCT_SPEC), then re-run.';

/** Run exactly one selected task directly (the `next` / single-id path). */
export async function runSingleTask(orch: RunOrchestrator, id: string): Promise<void> {
  const backlog = readBacklog(orch.projectPath);
  // taskSkipReason: why this task is not runnable right now (done, blocked, unmet deps), or null.
  const reason = taskSkipReason(backlog, id);
  if (reason !== null) {
    renderer.systemMessage(`Skipping ${id}: ${reason}`);
    return;
  }
  const task = findTask(backlog, id);
  if (task === undefined) return; // unreachable (taskSkipReason returned null), guarded defensively

  // Block on a dirty tree: each review must capture EXACTLY this task's changes (a fresh scaffold is
  // dirty until the user commits the baseline; a prior non-passing task stashes itself clean).
  if (isWorkingTreeDirty(orch.projectPath)) {
    renderer.errorLine(`Halting before ${id}: ${HALT_DIRTY}`);
    return;
  }

  renderer.systemMessage(`▶ Running ${task.id}: ${task.title}`);
  // runTaskAndReport: the loop plus its outcome line; null means the loop itself threw.
  const result = await runTaskAndReport(orch, task);

  // A non-passing task stashes its failed attempt so the tree is left clean and the work is preserved —
  // blocked → the later /answer→Retro reads it; escalated → the user can inspect it. The Worker NEVER
  // reuses the stash (a fresh Worker redoes the task from scratch); a git failure just returns null.
  if (result !== null && result.outcome !== 'passed') {
    const stashRef = stashTaskAttempt(orch.projectPath, task.id);
    const where = stashRef ?? 'nothing to stash';
    if (result.outcome === 'blocked') {
      renderer.systemMessage(`Attempt stashed (${where}). Answer with /answer ${task.id} <text>, then /run to retry.`);
    } else {
      renderer.systemMessage(`Attempt stashed (${where}) for inspection; /run ${task.id} to retry from scratch.`);
    }
  }
}
