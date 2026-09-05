// The one-line count that heads the /tasks tree. Split out of render-task-tree.ts; `headline` was
// qualified to `backlogHeadline` because two other renderers in this product already speak of a
// "headline" — render-verdict.ts's PASS/FAIL line and render-retro-result.ts's scope line — and a
// file called headline.ts would be the one a reader opens by mistake.

import type { Task, TaskStatus } from '../../core/session/index.js';
import { TASK_STATUS_LABEL } from './task-status-label.js';

/** `6 tasks · 2 done · 3 pending · 1 blocked` — only the statuses actually present are named. */
export function backlogHeadline(tasks: readonly Task[]): string {
  const counts = new Map<TaskStatus, number>();
  for (const task of tasks) counts.set(task.status, (counts.get(task.status) ?? 0) + 1);
  const parts = (Object.keys(TASK_STATUS_LABEL) as TaskStatus[])
    .filter((status) => (counts.get(status) ?? 0) > 0)
    .map((status) => `${counts.get(status) ?? 0} ${TASK_STATUS_LABEL[status]}`);
  const total = `${tasks.length} task${tasks.length === 1 ? '' : 's'}`;
  return `Backlog — ${[total, ...parts].join(' · ')}`;
}
