// Walk the backlog tree and read every task file. Named collectTaskFiles rather than the
// module-private `collect` it was extracted from, which says nothing standing alone.

import { readdirSync } from 'node:fs';
import path from 'node:path';

import { LEVEL_DOC } from './level-doc.js';
import { readTaskFile } from './read-task-file.js';
import type { Task } from './task.type.js';

/** Recursively collect every task file (any .md except README.md) under `dir`. */
export function collectTaskFiles(root: string, dir: string, out: Task[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTaskFiles(root, full, out);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md') && entry.name !== LEVEL_DOC) {
      // readTaskFile: one task .md into a Task, id/epic/story derived from its path under backlog/.
      out.push(readTaskFile(root, full));
    }
  }
}
