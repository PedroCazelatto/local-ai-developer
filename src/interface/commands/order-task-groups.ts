// Order the task tree's (epic, story) levels the way the execution loop will reach them. Split out of
// render-task-tree.ts; `orderGroups` was qualified to `orderTaskGroups` to match the TaskGroup it
// sorts — "groups" alone names no subject in a flat folder.

import type { Task } from '../../core/session/index.js';
import type { TaskGroup } from './task-group.type.js';

/**
 * Order the levels the way the execution loop will reach them — by the earliest `order` inside each —
 * while keeping one epic's stories together: an epic sorts by its own earliest task, so two of its
 * stories can never be split apart by a third epic whose orders happen to fall between them (which
 * would print the epic's header twice and stop the output being a tree at all).
 */
export function orderTaskGroups(groups: TaskGroup[]): TaskGroup[] {
  const firstOrder = (tasks: readonly Task[]): number => Math.min(...tasks.map((task) => task.order));
  const epicOrder = new Map<string, number>();
  for (const group of groups) {
    const key = group.epic ?? '';
    epicOrder.set(key, Math.min(epicOrder.get(key) ?? Number.MAX_SAFE_INTEGER, firstOrder(group.tasks)));
  }
  const rank = (group: TaskGroup): [number, string, number, string] => [
    epicOrder.get(group.epic ?? '') ?? Number.MAX_SAFE_INTEGER,
    group.epic ?? '',
    firstOrder(group.tasks),
    group.story ?? '',
  ];
  return [...groups].sort((left, right) => {
    const [le, len, ls, lsn] = rank(left);
    const [re, ren, rs, rsn] = rank(right);
    return le - re || len.localeCompare(ren) || ls - rs || lsn.localeCompare(rsn);
  });
}
