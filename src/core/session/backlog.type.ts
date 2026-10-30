// The whole backlog tree in memory: a flat, ordered list of tasks. The epic/story nesting lives in
// each task's id and its epic/story fields, not in a nested structure here.

import type { Task } from './task.type.js';

export interface Backlog {
  /** Every task in the tree, sorted by `order` then `id`. */
  readonly tasks: readonly Task[];
}
