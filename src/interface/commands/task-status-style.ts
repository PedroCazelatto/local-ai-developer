// A task's status mapped to the theme role that paints its row. Split out of render-task-tree.ts by
// the one-function-per-file sweep; `statusStyle` was qualified to `taskStatusStyle` on the way out,
// because a repo-visible `statusStyle` claims every status in the product and this one only knows
// the five a backlog task can hold.
//
// `failed` and `blocked` share `theme.danger` — the role theme.ts defines as "a failing /
// high-severity outcome", which is exactly what both are. They are told apart by the word in the
// status column; the colour only has to say "this one needs you".

import { theme } from '../../core/ui/theme.js';
import type { TaskStatus } from '../../core/session/task-status.type.js';
import type { RowStyle } from './row-style.type.js';

/** Status → its theme role. Colour repeats what the word says, so neither one alone has to be read. */
export function taskStatusStyle(status: TaskStatus): RowStyle {
  if (status === 'done') return theme.success;
  if (status === 'blocked' || status === 'failed') return theme.danger;
  if (status === 'in_progress') return theme.strong;
  return theme.meta;
}
