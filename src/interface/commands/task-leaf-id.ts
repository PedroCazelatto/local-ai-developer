// The last segment of a task id. Split out of render-task-tree.ts; `leafOf` was renamed because a
// file called leaf-of.ts names a relation rather than a job, and the value it returns is a task id.

import type { Task } from '../../core/session/task.type.js';

/** The last segment of a task id — what is left once the epic/story headers have named the rest. */
export function taskLeafId(task: Task): string {
  return task.id.split('/').pop() ?? task.id;
}
