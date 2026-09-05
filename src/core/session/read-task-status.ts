// Read the frontmatter `status` field of a task.
//
// Named readTaskStatus rather than the module-private `readStatus` it was extracted from: that name
// says nothing standing alone in a flat folder, and run-debate.ts declares a private `readStatus` of
// its own that means something else entirely.
//
// Forgiving of ABSENCE, loud about a WRONG VALUE, and the asymmetry is deliberate: a model that omits
// the field meant "not started", but a model that invents a status has misunderstood the vocabulary
// and must be told rather than silently defaulted.

import { BacklogError } from './backlog-error.js';
import type { TaskStatus } from './task-status.type.js';
import { TASK_STATUSES } from './task-statuses.js';

/** Absent -> `pending` (forgiving of a model that omits it); present-but-invalid -> a loud error. */
export function readTaskStatus(raw: unknown, where: string): TaskStatus {
  if (raw === undefined || raw === null) return 'pending';
  if (typeof raw === 'string' && (TASK_STATUSES as readonly string[]).includes(raw)) {
    return raw as TaskStatus;
  }
  throw new BacklogError(`Task '${where}' has status '${String(raw)}' — must be one of ${TASK_STATUSES.join(' | ')}.`);
}
