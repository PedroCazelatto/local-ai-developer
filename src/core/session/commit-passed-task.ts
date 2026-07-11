// Commit a task that PASSED review (V3/01 auto-commit on pass, via the V2/03 commit tooling). This
// is the ONLY place the fix loop writes to the project git history, and only ever on a Reviewer
// `pass`. It flips the task's backlog status to `done`, stages EXACTLY the reviewed changed-files
// set plus the task's own backlog file (so the commit records `status: done` and leaves a clean
// tree for the next task), and commits with the convention message. On a commit failure — e.g. a
// path escaping the project repo, the guard that keeps a global-rule edit from ever being
// auto-committed (constitution: instruction files are never auto-committed) — it reverts the status
// to `pending` and throws, committing nothing.

import { BACKLOG_DIRNAME, setTaskStatus } from './backlog.js';
import { buildCommitMessage } from './commit-message.js';
import { commitPaths } from './project-git.js';
import type { ReviewVerdict } from './review-types.js';
import type { Task } from './types.js';

/** Flip status→done, stage the reviewed set + backlog file, commit; returns the short SHA (or throws). */
export function commitPassedTask(
  projectPath: string,
  task: Task,
  verdict: ReviewVerdict,
  changedFiles: readonly string[],
): string | undefined {
  setTaskStatus(projectPath, task.id, 'done');
  const backlogRel = `${BACKLOG_DIRNAME}/${task.id}.md`;
  const staged = changedFiles.includes(backlogRel) ? [...changedFiles] : [...changedFiles, backlogRel];

  // buildCommitMessage: the convention subject + Reviewer summary + "Reviewed-by" trailer (V2/03).
  const message = buildCommitMessage({
    taskId: task.id,
    taskTitle: task.title,
    type: 'feat',
    reviewerSummary: verdict.summary,
  });
  // commitPaths: stages ONLY these paths (never `git add -A`) and refuses any that escape the repo.
  const commit = commitPaths(projectPath, message, staged);
  if (commit.committed) {
    return commit.sha;
  }

  // Passed review but the commit itself failed: undo the `done` flip so the task stays runnable and
  // the dirty tree honestly reflects "not committed", then surface the failure to the caller.
  setTaskStatus(projectPath, task.id, 'pending');
  throw new Error(`commit failed for ${task.id}: ${commit.error ?? 'unknown error'}`);
}
