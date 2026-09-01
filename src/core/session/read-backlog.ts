// Read + validate the whole backlog tree. This is the entry point every reader goes through, and the
// one place the sort order is established: `order` first, then id as the tiebreak, so two tasks that
// forgot to differ by order still come back in a stable sequence.

import { existsSync, statSync } from 'node:fs';

import { BacklogError } from './backlog-error.js';
import { backlogRoot } from './backlog-root.js';
import { collectTaskFiles } from './collect-task-files.js';
import type { Backlog, Task } from './types.js';

/** Read + validate the whole backlog tree. Throws BacklogError if backlog/ is missing/malformed. */
export function readBacklog(projectPath: string): Backlog {
  // backlogRoot: <projectPath>/backlog.
  const root = backlogRoot(projectPath);
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new BacklogError(`No backlog/ directory in the project. Run the Breakdown phase to produce one.`);
  }
  const tasks: Task[] = [];
  // collectTaskFiles: every .md under the tree except README.md, read into a Task.
  collectTaskFiles(root, root, tasks);
  tasks.sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { tasks };
}
