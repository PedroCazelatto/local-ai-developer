// The human wording for each of the four task statuses. A vocabulary constant with three readers —
// backlog-headline.ts counts by it, task-row.ts prints it, render-task-tree.ts measures the widest
// one for the status column — so it belongs to none of them.
//
// The key set is `TaskStatus`, so a fifth status added to the union fails the build here rather than
// printing an empty column.

import type { TaskStatus } from '../../core/session/task-status.type.js';

/** Human labels for the four statuses — the status column, padded to the widest one in the tree. */
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'pending',
  in_progress: 'in progress',
  done: 'done',
  blocked: 'blocked',
};
