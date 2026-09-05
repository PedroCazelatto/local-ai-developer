// Record that a task was attempted and failed, durably, in the file that drives scheduling: write
// `status: failed` into the task's own frontmatter and commit that one path. This is the orchestrator's
// FOURTH committer, beside the planning phases, the Reviewer and Retro (docs/phases.md, "Who may
// commit"), and it commits exactly one file: the escalated task's .md.
//
// ORDER IS THE WHOLE DESIGN, and it is not a style choice:
//
//   1. stashTaskAttempt  — `git stash push -u` over the WHOLE tree;
//   2. this write         — into a tree the stash has just reset to HEAD;
//   3. this commit        — immediately after the write, with no third party in between.
//
// Anything written into the frontmatter BEFORE the stash is reset to HEAD and disappears with the
// failed attempt, which is why the record cannot be made where the loop decides the outcome
// (run-task-loop.ts). And the stash is what makes step 3 safe: it leaves the tree AND the index clean,
// so `git add` + `git commit` can only carry the one path named here. Called before the stash instead,
// the same commit would sweep up anything the attempt had left staged.
//
// It is safe against the Reviewer's verdict check for a reason of the same shape — see the call sites:
// the loop reaches an escalation only once the last Reviewer has spoken, so there is no live verdict
// for this commit to contradict (OPEN-QUESTIONS #77).
//
// Never throws. Both callers are on a path where losing the record is far preferable to dying, and the
// batch driver in particular must not turn one task's git failure into an aborted night. When the
// commit does fail the write is ROLLED BACK, so the tree is left exactly as clean as it was found —
// the next task in the batch would otherwise be skipped as dirty, which is the failure this whole
// feature exists to prevent, in a new costume.

import { readFileSync, writeFileSync } from 'node:fs';

import { errMessage } from '../err-message.js';
import { BACKLOG_DIRNAME } from './backlog-root.js';
import { buildFailedAttemptCommitMessage } from './build-failed-attempt-commit-message.js';
import { commitPaths } from './commit-paths.js';
import { setTaskStatus } from './set-task-status.js';
import { taskFilePath } from './task-file-path.js';

/** What the escalation record cost and whether it landed. `recorded` is the only thing a caller must trust. */
export interface FailedAttemptRecord {
  /** True when the committed task file says `failed` — either this call committed it, or HEAD already did. */
  readonly recorded: boolean;
  /** Short SHA of the commit this call made; null when it committed nothing (already recorded, or failed). */
  readonly sha: string | null;
  /** Structured, recoverable reason when `recorded` is false. The frontmatter write is rolled back. */
  readonly error?: string;
}

/**
 * Write `status: failed` into the escalated task's frontmatter and commit that one path. **Call this
 * immediately after `stashTaskAttempt` and nowhere else** — the stash resets the tree to HEAD, so a
 * write made before it is lost, and a commit made before it can sweep up staged leftovers. Never
 * throws; a failure rolls the write back and comes home in `error`.
 */
export function recordFailedAttempt(projectPath: string, taskId: string): FailedAttemptRecord {
  // taskFilePath: <projectPath>/backlog/<id>.md. The relative form is what git is given, always with
  // forward slashes — a task id is slash-separated on every OS, so no separator translation is needed.
  const absolute = taskFilePath(projectPath, taskId);
  const relative = `${BACKLOG_DIRNAME}/${taskId}.md`;

  let before: string;
  try {
    before = readFileSync(absolute, 'utf-8');
  } catch (err) {
    // errMessage: an Error's message, or the thrown value stringified.
    return { recorded: false, sha: null, error: `could not read ${relative}: ${errMessage(err)}` };
  }

  try {
    // setTaskStatus: surgical frontmatter rewrite; throws BacklogError when the id has no file.
    setTaskStatus(projectPath, taskId, 'failed');
  } catch (err) {
    return { recorded: false, sha: null, error: `could not mark ${taskId} failed: ${errMessage(err)}` };
  }

  // Byte-identical means the file already said `failed`, and since the stash has just reset it to HEAD
  // that is HEAD's own text: the record is there, this attempt is a repeat, and there is nothing to
  // commit. Committing anyway would report a spurious failure ("nothing staged?").
  if (readFileSync(absolute, 'utf-8') === before) {
    return { recorded: true, sha: null };
  }

  // commitPaths: stages ONLY the paths given and refuses any that escapes the project repo.
  const commit = commitPaths(projectPath, buildFailedAttemptCommitMessage(taskId), [relative]);
  if (!commit.committed) {
    // Roll the write back rather than leave the tree dirty by one file: every dirty-tree gate stays
    // strict (OPEN-QUESTIONS #70c), so a leftover write here would skip every task that follows.
    writeFileSync(absolute, before, 'utf-8');
    return { recorded: false, sha: null, error: commit.error ?? 'the escalation commit failed.' };
  }
  return { recorded: true, sha: commit.sha ?? null };
}
