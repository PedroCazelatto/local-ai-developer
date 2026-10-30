// Look one task up by id — the id being its path under backlog/ without ".md".

import type { Backlog } from './backlog.type.js';
import type { Task } from './task.type.js';

/** Find one task by id (backlog-relative path without .md), or undefined. */
export function findTask(backlog: Backlog, taskId: string): Task | undefined {
  return backlog.tasks.find((task) => task.id === taskId);
}
