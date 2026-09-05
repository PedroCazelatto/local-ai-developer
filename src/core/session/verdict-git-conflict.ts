// The consistency rules between a Reviewer verdict and the actual state of the project repo. Kept
// PURE — it is handed the git facts rather than reading them — so the rules are one readable list and
// the window stays the only place that touches git.
//
// Three rules, all of them things a local model gets wrong confidently:
//   1. A "pass" may not leave uncommitted work. The Reviewer commits what it accepts, so anything
//      still in the tree is by definition not accepted — passing would silently drop it.
//   2. A "pass" requires the task marked done, so a passed task can never stay runnable forever.
//   3. Every file the Reviewer did NOT commit must be named in an issue, so the Worker is never handed
//      a file back without being told what is wrong with it.
// A "fail" on a CLEAN tree is legal and deliberate: the Reviewer may commit everything the Worker
// wrote and still fail the task for work that is missing entirely.

import { issueCoversFile } from './issue-covers-file.js';
import { toPosixTrimmed } from './to-posix-trimmed.js';
import type { ReviewVerdict } from './types.js';
import { SEVERITIES } from './types.js';

export interface VerdictGitState {
  /** The parsed, shape-valid verdict the Reviewer just submitted. */
  readonly verdict: ReviewVerdict;
  /** Project-relative paths still uncommitted after the Reviewer's own commits this round. */
  readonly outstanding: readonly string[];
  /** True once the Reviewer called mark_task_done for the task under review. */
  readonly taskMarkedDone: boolean;
  /** Backlog id of the task under review — named in the error so the Reviewer knows what to close. */
  readonly taskId: string;
}

/**
 * The reason this verdict contradicts the repo, or null when it is consistent. The string is fed
 * straight back to the Reviewer as a recoverable error, so it names the offending files and the fix.
 */
export function verdictGitConflict(state: VerdictGitState): string | null {
  // toPosixTrimmed: backslashes to slashes, trimmed — the model may echo either separator.
  const outstanding = state.outstanding.map(toPosixTrimmed).filter((file) => file !== '');

  if (state.verdict.result === 'pass') {
    if (outstanding.length > 0) {
      return (
        `result is "pass" but ${outstanding.length} file(s) are still uncommitted: ${outstanding.join(', ')}. ` +
        'A pass means everything is accepted — commit them with commit_changes, or set result to "fail" ' +
        'and give an issue for each file you are sending back.'
      );
    }
    if (!state.taskMarkedDone) {
      return (
        `result is "pass" but task '${state.taskId}' is not marked done. Call mark_task_done, commit the ` +
        'backlog file it changed with commit_changes, then submit the pass.'
      );
    }
    return null;
  }

  // fail — every file left behind must carry a note, so the Worker knows why it came back.
  const named = state.verdict.issues.map((issue) => toPosixTrimmed(issue.file)).filter((file) => file !== '');
  // issueCoversFile: an exact match, or a directory named in an issue that contains the file.
  const unexplained = outstanding.filter((file) => !named.some((path) => issueCoversFile(path, file)));
  if (unexplained.length > 0) {
    return (
      `you left ${unexplained.length} file(s) uncommitted with no issue explaining why: ${unexplained.join(', ')}. ` +
      `Every file you do not commit goes back to the Worker, so each one needs an issue naming it — add one ` +
      `(severity ${SEVERITIES.join('/')}) per file, or commit the file if it is actually fine.`
    );
  }
  return null;
}
