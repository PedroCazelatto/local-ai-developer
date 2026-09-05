// The dependencies still standing between a task and its turn. Split out of render-task-tree.ts.

import type { Task, TaskStatus } from '../../core/session/index.js';
import { relativeDepId } from './relative-dep-id.js'; // a dep id shortened against the task that names it

/**
 * The dependencies still standing between a task and its turn: every `depends_on` id that is not
 * `done`, with one that is not in the backlog at all called out — an id nobody will ever mark done is
 * a task that can never run, and it is invisible in the file that declares it.
 */
export function unmetDeps(task: Task, statusById: ReadonlyMap<string, TaskStatus>): string[] {
  return task.dependsOn
    .filter((depId) => statusById.get(depId) !== 'done')
    .map((depId) => (statusById.has(depId) ? relativeDepId(depId, task) : `${relativeDepId(depId, task)} (missing)`));
}
