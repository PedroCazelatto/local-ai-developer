// One task's row in the /tasks tree. Split out of render-task-tree.ts.

import { theme } from '../../core/ui/theme.js';
import type { TaskStatus } from '../../core/session/task-status.type.js';
import type { Task } from '../../core/session/task.type.js';
import type { FittedRow } from './fitted-row.type.js';
import { TASK_STATUS_LABEL } from './task-status-label.js';
import { TREE_INDENT } from './tree-indent.js';
import { taskLeafId } from './task-leaf-id.js'; // the last segment of a task id
import { taskOrderLabel } from './task-order-label.js'; // `#3`, or `#?` for an unordered task
import { taskStatusStyle } from './task-status-style.js'; // status → its theme role
import { unmetDeps } from './unmet-deps.js'; // the depends_on ids that are not done yet

/** One task's row: the next-pick marker, its status, its order, its leaf id, unmet deps, then the title. */
export function taskRow(
  task: Task,
  depth: number,
  isNext: boolean,
  widths: { readonly status: number; readonly order: number },
  statusById: ReadonlyMap<string, TaskStatus>,
): FittedRow {
  const fields = [`${taskLeafId(task)}`];
  const unmet = unmetDeps(task, statusById);
  if (unmet.length > 0) fields.push(`waits on: ${unmet.join(', ')}`);
  if (task.title !== '' && task.title !== taskLeafId(task)) fields.push(task.title);
  const marker = isNext ? '▶' : ' ';
  const text =
    `${TREE_INDENT.repeat(depth)}${marker} ${TASK_STATUS_LABEL[task.status].padEnd(widths.status)}  ` +
    `${taskOrderLabel(task.order).padStart(widths.order)}  ${fields.join(' · ')}`;
  // The task /run next would pick is emphasized rather than colored by status: which one is next is
  // the question the tree is being read to answer, and it has to win over its own status colour.
  return { text, style: isNext ? theme.strong : taskStatusStyle(task.status) };
}
