// Every task, in execution order. readBacklog already sorted them; the copy is defensive so a caller
// cannot sort or splice the backlog's own array out from under another reader.

import type { Backlog, Task } from './types.js';

/** Every task, sorted by `order` then id (readBacklog already sorts; copy defensively). */
export function allTasks(backlog: Backlog): Task[] {
  return [...backlog.tasks];
}
