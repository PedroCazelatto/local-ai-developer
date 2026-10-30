// renderTaskTree — the backlog as a compact epic/story tree, one row per task. Pure: state in, rows
// out, nothing printed and no file read, so the whole look is reviewable in isolation (the property
// render-question-panel.ts has, and the reason it can be replayed through a grid emulator).
//
// A TREE rather than the flat ordered list `/run` selects from, by the user's decision: the tree is
// how the Breakdown phase actually writes the backlog, and an id repeated in full on every row buries
// the two segments that differ. So each level names itself once and a task row carries only its LEAF —
// the same reasoning renderFileTree uses for the file listing it sends the model.
//
// Every row still carries what the flat list would have shown: status, order, unmet dependencies, and
// the one task `/run next` would pick. Fields are ordered by how much the reader needs them, because
// a narrow terminal cuts the tail: the marker, status and order first, then the id, then the
// dependencies, and the title last — it is the only field that is not load-bearing.

import type { Backlog } from '../../core/session/backlog.type.js';
import { theme } from '../../core/ui/theme.js';
import type { FittedRow } from './fitted-row.type.js';
import { TASK_STATUS_LABEL } from './task-status-label.js';
import { TREE_INDENT } from './tree-indent.js';
import { backlogHeadline } from './backlog-headline.js'; // `6 tasks · 2 done · …`, only the statuses present
import { groupTasks } from './group-tasks.js'; // fold the flat task list into its (epic, story) levels
import { orderTaskGroups } from './order-task-groups.js'; // levels in the order the loop will reach them
import { taskOrderLabel } from './task-order-label.js'; // `#3`, or `#?` for an unordered task
import { taskRow } from './task-row.js'; // one task's row: marker, status, order, leaf id, deps, title

/**
 * The backlog as a tree of rows. `nextTaskId` is the id `/run next` would select right now (the caller
 * takes it from nextRunnableTasks, so the mark and the command agree by construction); null when
 * nothing is runnable.
 */
export function renderTaskTree(backlog: Backlog, nextTaskId: string | null): FittedRow[] {
  const tasks = backlog.tasks;
  if (tasks.length === 0) {
    return [{ text: 'The backlog has no task files yet — run the Breakdown phase to produce them.', style: theme.meta }];
  }

  const statusById = new Map(tasks.map((task) => [task.id, task.status]));
  const widths = {
    status: Math.max(...tasks.map((task) => TASK_STATUS_LABEL[task.status].length)),
    order: Math.max(...tasks.map((task) => taskOrderLabel(task.order).length)),
  };

  const rows: FittedRow[] = [{ text: backlogHeadline(tasks), style: theme.strong }, { text: '', style: theme.meta }];

  let lastEpic: string | null = null;
  for (const group of orderTaskGroups(groupTasks(tasks))) {
    // An epic names itself once, above its stories; a story names itself under its own epic. A task
    // sitting straight in backlog/ has neither and simply starts at the left margin.
    if (group.epic !== null && group.epic !== lastEpic) {
      rows.push({ text: `${group.epic}/`, style: theme.strong });
    }
    lastEpic = group.epic;
    if (group.story !== null) {
      rows.push({ text: `${TREE_INDENT}${group.story}/`, style: theme.strong });
    }
    const depth = (group.epic === null ? 0 : 1) + (group.story === null ? 0 : 1);
    for (const task of group.tasks) {
      rows.push(taskRow(task, depth, task.id === nextTaskId, widths, statusById));
    }
  }
  return rows;
}
