// Group the backlog's tasks by the (epic, story) level they sit in. Split out of render-task-tree.ts.

import type { Task } from '../../core/session/task.type.js';
import type { TaskGroup } from './task-group.type.js';

/** Group the tasks by their (epic, story) level, keeping each level's tasks in backlog order. */
export function groupTasks(tasks: readonly Task[]): TaskGroup[] {
  const byLevel = new Map<string, TaskGroup>();
  for (const task of tasks) {
    // NUL-joined so an epic or story folder whose name contains the separator can never fold two
    // different levels onto one key.
    const key = `${task.epic ?? ''}\u0000${task.story ?? ''}`;
    const existing = byLevel.get(key);
    if (existing === undefined) {
      byLevel.set(key, { epic: task.epic, story: task.story, tasks: [task] });
    } else {
      existing.tasks.push(task);
    }
  }
  return [...byLevel.values()];
}
