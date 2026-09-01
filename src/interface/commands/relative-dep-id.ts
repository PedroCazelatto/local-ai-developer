// A dependency id shortened against the task that depends on it. Split out of render-task-tree.ts.

import type { Task } from '../../core/session/index.js';

/**
 * A dependency id with the part the reader is already standing in stripped off: a sibling in the same
 * story shows as its leaf, one elsewhere in the same epic keeps its story, and one in another epic
 * keeps its whole id — so a short name always means "near here" and a long one always means "not".
 */
export function relativeDepId(depId: string, task: Task): string {
  if (task.epic !== null && task.story !== null && depId.startsWith(`${task.epic}/${task.story}/`)) {
    return depId.slice(`${task.epic}/${task.story}/`.length);
  }
  if (task.epic !== null && depId.startsWith(`${task.epic}/`)) return depId.slice(`${task.epic}/`.length);
  return depId;
}
