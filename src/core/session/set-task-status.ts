// Flip one task's status in its own .md file — the only write the backlog reader half performs. The
// task file is committed project content, so the rewrite is surgical (replace-status.ts) rather than a
// re-serialisation of the parsed task.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { errMessage } from '../err-message.js';
import { BacklogError } from './backlog-error.js';
import { replaceStatus } from './replace-status.js';
import { taskFilePath } from './task-file-path.js';
import type { TaskStatus } from './task-status.type.js';

/** Flip one task's status in its own .md file. Throws BacklogError if the id isn't in the backlog. */
export function setTaskStatus(projectPath: string, taskId: string, status: TaskStatus): void {
  // taskFilePath: <projectPath>/backlog/<id>.md, the id's slashes read as folders.
  const filePath = taskFilePath(projectPath, taskId);
  if (!existsSync(filePath)) {
    throw new BacklogError(`Task '${taskId}' not found in the backlog.`);
  }
  let text: string;
  try {
    text = readFileSync(filePath, 'utf-8');
  } catch (err) {
    // errMessage: an Error's message, or the thrown value stringified.
    throw new BacklogError(`Could not read task '${taskId}': ${errMessage(err)}`);
  }
  // replaceStatus: rewrites just the frontmatter `status:` line, preserving the rest verbatim.
  writeFileSync(filePath, replaceStatus(text, status), 'utf-8');
}
