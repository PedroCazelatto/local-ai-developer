// Discard the task loop's own stash for a task. Never throws — a git failure is simply a no-op, since
// every caller is in a path where losing the record is preferable to dying mid-turn.

import { findTaskStashRef } from './find-task-stash-ref.js';
import { runGit } from './run-git.js';

/** Drop the task's labeled stash if it has one (a no-op otherwise). Never throws. */
export function dropTaskStash(projectPath: string, taskId: string): void {
  // findTaskStashRef: resolves `stash@{n}` by the task-keyed LABEL, so it survives later stashes.
  const ref = findTaskStashRef(projectPath, taskId);
  if (ref !== null) runGit(projectPath, ['stash', 'drop', ref]);
}
