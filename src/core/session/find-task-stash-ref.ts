// Resolve a task's stash by its LABEL, never by index: `stash@{n}` shifts whenever anything else is
// stashed, and both the task loop and the model's shelf tool stash on their own schedules.

import { runGit } from './run-git.js';
import { TASK_STASH_LABEL_PREFIX } from './task-stash-label-prefix.js';

/** The `stash@{n}` ref of the task's labeled stash, or null if it has none (found by message, not index,
 * so it survives other stashes pushed after it). */
export function findTaskStashRef(projectPath: string, taskId: string): string | null {
  const label = `${TASK_STASH_LABEL_PREFIX}${taskId}`;
  for (const line of runGit(projectPath, ['stash', 'list']).stdout.split('\n')) {
    // `git stash list` prints `stash@{n}: On <branch>: <message>` — the message is the trailing text.
    const ref = /^(stash@\{\d+\})/.exec(line)?.[1];
    if (ref !== undefined && line.trimEnd().endsWith(`: ${label}`)) return ref;
  }
  return null;
}
