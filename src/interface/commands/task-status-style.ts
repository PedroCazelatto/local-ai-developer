// A task's status mapped to the theme role that paints its row. Split out of render-task-tree.ts by
// the one-function-per-file sweep; `statusStyle` was qualified to `taskStatusStyle` on the way out,
// because a repo-visible `statusStyle` claims every status in the product and this one only knows
// the four a backlog task can hold.

import { theme } from '../../core/ui/theme.js';
import type { TaskStatus } from '../../core/session/index.js';
import type { RowStyle } from './row-style.type.js';

/** Status → its theme role. Colour repeats what the word says, so neither one alone has to be read. */
export function taskStatusStyle(status: TaskStatus): RowStyle {
  if (status === 'done') return theme.success;
  if (status === 'blocked') return theme.danger;
  if (status === 'in_progress') return theme.strong;
  return theme.meta;
}
