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

import type { Backlog, Task, TaskStatus } from '../../core/session/index.js';
import { theme } from '../../core/ui/theme.js';
import type { FittedRow, RowStyle } from './write-fitted-line.type.js';

/** One (epic, story) level of the tree with the tasks that sit directly in it. */
interface Group {
  readonly epic: string | null;
  readonly story: string | null;
  readonly tasks: Task[];
}

/** Two spaces per level, so an epic/story/task path reads as depth without drawing box glyphs. */
const INDENT = '  ';

/** Human labels for the four statuses — the status column, padded to the widest one in the tree. */
const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'pending',
  in_progress: 'in progress',
  done: 'done',
  blocked: 'blocked',
};

/** Status → its theme role. Colour repeats what the word says, so neither one alone has to be read. */
function statusStyle(status: TaskStatus): RowStyle {
  if (status === 'done') return theme.success;
  if (status === 'blocked') return theme.danger;
  if (status === 'in_progress') return theme.strong;
  return theme.meta;
}

/**
 * `#3`, or `#?` when the task set no order and its file name carries no leading number — readBacklog
 * sorts those last with a sentinel, and printing the sentinel's raw value would be noise pretending
 * to be a position (constitution: surface an absent value, never dress it up).
 */
function orderLabel(order: number): string {
  return order === Number.MAX_SAFE_INTEGER ? '#?' : `#${order}`;
}

/** The last segment of a task id — what is left once the epic/story headers have named the rest. */
function leafOf(task: Task): string {
  return task.id.split('/').pop() ?? task.id;
}

/**
 * A dependency id with the part the reader is already standing in stripped off: a sibling in the same
 * story shows as its leaf, one elsewhere in the same epic keeps its story, and one in another epic
 * keeps its whole id — so a short name always means "near here" and a long one always means "not".
 */
function relativeDepId(depId: string, task: Task): string {
  if (task.epic !== null && task.story !== null && depId.startsWith(`${task.epic}/${task.story}/`)) {
    return depId.slice(`${task.epic}/${task.story}/`.length);
  }
  if (task.epic !== null && depId.startsWith(`${task.epic}/`)) return depId.slice(`${task.epic}/`.length);
  return depId;
}

/**
 * The dependencies still standing between a task and its turn: every `depends_on` id that is not
 * `done`, with one that is not in the backlog at all called out — an id nobody will ever mark done is
 * a task that can never run, and it is invisible in the file that declares it.
 */
function unmetDeps(task: Task, statusById: ReadonlyMap<string, TaskStatus>): string[] {
  return task.dependsOn
    .filter((depId) => statusById.get(depId) !== 'done')
    .map((depId) => (statusById.has(depId) ? relativeDepId(depId, task) : `${relativeDepId(depId, task)} (missing)`));
}

/** Group the tasks by their (epic, story) level, keeping each level's tasks in backlog order. */
function groupTasks(tasks: readonly Task[]): Group[] {
  const byLevel = new Map<string, Group>();
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

/**
 * Order the levels the way the execution loop will reach them — by the earliest `order` inside each —
 * while keeping one epic's stories together: an epic sorts by its own earliest task, so two of its
 * stories can never be split apart by a third epic whose orders happen to fall between them (which
 * would print the epic's header twice and stop the output being a tree at all).
 */
function orderGroups(groups: Group[]): Group[] {
  const firstOrder = (tasks: readonly Task[]): number => Math.min(...tasks.map((task) => task.order));
  const epicOrder = new Map<string, number>();
  for (const group of groups) {
    const key = group.epic ?? '';
    epicOrder.set(key, Math.min(epicOrder.get(key) ?? Number.MAX_SAFE_INTEGER, firstOrder(group.tasks)));
  }
  const rank = (group: Group): [number, string, number, string] => [
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

/** `6 tasks · 2 done · 3 pending · 1 blocked` — only the statuses actually present are named. */
function headline(tasks: readonly Task[]): string {
  const counts = new Map<TaskStatus, number>();
  for (const task of tasks) counts.set(task.status, (counts.get(task.status) ?? 0) + 1);
  const parts = (Object.keys(STATUS_LABEL) as TaskStatus[])
    .filter((status) => (counts.get(status) ?? 0) > 0)
    .map((status) => `${counts.get(status) ?? 0} ${STATUS_LABEL[status]}`);
  const total = `${tasks.length} task${tasks.length === 1 ? '' : 's'}`;
  return `Backlog — ${[total, ...parts].join(' · ')}`;
}

/** One task's row: the next-pick marker, its status, its order, its leaf id, unmet deps, then the title. */
function taskRow(
  task: Task,
  depth: number,
  isNext: boolean,
  widths: { readonly status: number; readonly order: number },
  statusById: ReadonlyMap<string, TaskStatus>,
): FittedRow {
  const fields = [`${leafOf(task)}`];
  const unmet = unmetDeps(task, statusById);
  if (unmet.length > 0) fields.push(`waits on: ${unmet.join(', ')}`);
  if (task.title !== '' && task.title !== leafOf(task)) fields.push(task.title);
  const marker = isNext ? '▶' : ' ';
  const text =
    `${INDENT.repeat(depth)}${marker} ${STATUS_LABEL[task.status].padEnd(widths.status)}  ` +
    `${orderLabel(task.order).padStart(widths.order)}  ${fields.join(' · ')}`;
  // The task /run next would pick is emphasized rather than colored by status: which one is next is
  // the question the tree is being read to answer, and it has to win over its own status colour.
  return { text, style: isNext ? theme.strong : statusStyle(task.status) };
}

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
    status: Math.max(...tasks.map((task) => STATUS_LABEL[task.status].length)),
    order: Math.max(...tasks.map((task) => orderLabel(task.order).length)),
  };

  const rows: FittedRow[] = [{ text: headline(tasks), style: theme.strong }, { text: '', style: theme.meta }];

  let lastEpic: string | null = null;
  for (const group of orderGroups(groupTasks(tasks))) {
    // An epic names itself once, above its stories; a story names itself under its own epic. A task
    // sitting straight in backlog/ has neither and simply starts at the left margin.
    if (group.epic !== null && group.epic !== lastEpic) {
      rows.push({ text: `${group.epic}/`, style: theme.strong });
    }
    lastEpic = group.epic;
    if (group.story !== null) {
      rows.push({ text: `${INDENT}${group.story}/`, style: theme.strong });
    }
    const depth = (group.epic === null ? 0 : 1) + (group.story === null ? 0 : 1);
    for (const task of group.tasks) {
      rows.push(taskRow(task, depth, task.id === nextTaskId, widths, statusById));
    }
  }
  return rows;
}
