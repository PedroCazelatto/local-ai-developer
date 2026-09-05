// The execution trigger's view of the backlog (V1/10): what may run right now, in order.

import type { Backlog, Task } from './types.js';

/**
 * Tasks eligible to run now — status `pending` AND every `depends_on` id already `done` — sorted by
 * `order`. A dependency that doesn't exist counts as unmet (defense in depth: the trigger trusts
 * `order` for sequence but still skips a task whose deps aren't done).
 */
export function nextRunnableTasks(backlog: Backlog): Task[] {
  const statusById = new Map(backlog.tasks.map((task) => [task.id, task.status]));
  const depsDone = (task: Task): boolean => task.dependsOn.every((depId) => statusById.get(depId) === 'done');
  return backlog.tasks
    .filter((task) => task.status === 'pending' && depsDone(task))
    .sort((a, b) => a.order - b.order);
}
