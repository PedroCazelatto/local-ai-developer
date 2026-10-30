// Why a named task cannot run — the single-task /run path's counterpart to nextRunnableTasks.

import type { Backlog } from './backlog.type.js';
import { findTask } from './find-task.js';

/**
 * Why a task can't run right now — already done, blocked awaiting the user's /answer, or a dependency
 * that isn't `done` — or null when it is runnable. Shared by the single-task /run path and the batch
 * driver (V3/05) so both skip identically. A missing task id is itself a skip reason.
 *
 * A `failed` task is deliberately NOT a skip reason: `/run <id>` retries it from scratch, and this
 * predicate is the one both paths share, so refusing it here would refuse the retry too. The `/run all`
 * skip lives in resolveSelector instead, which only the batch selector goes through.
 */
export function taskSkipReason(backlog: Backlog, taskId: string): string | null {
  // findTask: the task with this id, or undefined.
  const task = findTask(backlog, taskId);
  if (task === undefined) return 'not found in the backlog.';
  if (task.status === 'done') return 'already done.';
  if (task.status === 'blocked') return 'blocked, awaiting your /answer (answer it, then re-run).';
  const statusById = new Map(backlog.tasks.map((t) => [t.id, t.status]));
  const unmet = task.dependsOn.filter((depId) => statusById.get(depId) !== 'done');
  if (unmet.length > 0) return `waiting on ${unmet.join(', ')} (not done).`;
  return null;
}
