// The one formula that maps a backlog task id onto the file that holds it. The PATH is the identity
// (read-task-file.ts derives the id from the path), so this is that derivation run backwards, and it
// lives in one place because two copies of it could disagree about a nested id.

import path from 'node:path';

import { backlogRoot } from './backlog-root.js';

/** Absolute path of the task's .md file: `<projectPath>/backlog/<id>.md`, with `/` in the id as folders. */
export function taskFilePath(projectPath: string, taskId: string): string {
  // backlogRoot: <projectPath>/backlog. A task id is always slash-separated, whatever the OS.
  return `${path.join(backlogRoot(projectPath), ...taskId.split('/'))}.md`;
}
