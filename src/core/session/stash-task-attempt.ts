// Preserve a failed Worker attempt instead of discarding it. The stash message IS the durable record
// (there is no separate store), which is why the label is task-keyed and why the namespace is disjoint
// from the model's own shelf — see task-stash-label-prefix.ts.

import { dropTaskStash } from './drop-task-stash.js';
import { findTaskStashRef } from './find-task-stash-ref.js';
import { runGit } from './run-git.js';
import { TASK_STASH_LABEL_PREFIX } from './task-stash-label-prefix.js';

/**
 * Stash the current uncommitted attempt under a task-keyed label so it is preserved (not discarded) when
 * a task ends non-passing — the Worker NEVER reuses it (a fresh Worker redoes the task from scratch); it
 * exists so Retro can inspect what went wrong (blocked) or the user can review it (escalated). Includes
 * untracked files (`-u`) but never git-ignored state (`.orchestrator/`). Supersedes any prior stash for
 * the task (keeps only the latest attempt). Returns the stable label, or null if there was nothing to
 * stash. Never throws — a git failure just returns null (the caller falls back to a dirty/clean tree).
 */
export function stashTaskAttempt(projectPath: string, taskId: string): string | null {
  // dropTaskStash: removes the task's prior stash if it has one; a no-op otherwise.
  dropTaskStash(projectPath, taskId); // supersede a prior attempt so at most one stash per task exists
  const label = `${TASK_STASH_LABEL_PREFIX}${taskId}`;
  const push = runGit(projectPath, ['stash', 'push', '-u', '-m', label]);
  // "No local changes to save" exits 0 and creates NO stash (e.g. an escalation with an empty diff).
  if (!push.ok || /no local changes/i.test(push.stdout)) return null;
  // findTaskStashRef: resolves `stash@{n}` by the task-keyed LABEL, so it survives later stashes.
  return findTaskStashRef(projectPath, taskId) === null ? null : label;
}
