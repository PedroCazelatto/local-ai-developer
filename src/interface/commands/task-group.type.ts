// One (epic, story) level of the task tree with the tasks that sit directly in it.
//
// Owned by no function: group-tasks.ts builds them, order-task-groups.ts sorts them, and
// render-task-tree.ts walks them — the CompletionCycle shape, so it gets its own file. It was `Group`
// while it was private to render-task-tree.ts; extracted, a type called `Group` says nothing about
// what it groups, so it is qualified here.

import type { Task } from '../../core/session/task.type.js';

/** One (epic, story) level of the tree with the tasks that sit directly in it. */
export interface TaskGroup {
  readonly epic: string | null;
  readonly story: string | null;
  readonly tasks: Task[];
}
