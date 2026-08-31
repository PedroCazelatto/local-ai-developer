// Model-facing push — backs the git_push tool. Deliberately takes NO arguments beyond the project: it
// always pushes the CHECKED-OUT branch to `origin` with `-u`, and there is no force, no remote
// argument and no refspec for a model to get wrong.
//
// The asymmetry the task turns on:
//
// - A missing REMOTE BRANCH is fine. `-u` creates it, which is how a task branch first reaches the
//   remote.
// - A missing REPOSITORY is an ERROR. The model never creates a GitHub repository, so a push with no
//   destination fails with a recoverable message that tells it to ask the user to create the repo —
//   and the user does it. That is the whole point of distinguishing the two.

import { currentBranch } from './current-branch.js';
import { hasOrigin } from './has-origin.js';
import { isMissingRepository } from './is-missing-repository.js';
import { REMOTE } from './push-remote.js';
import { runGit } from './run-git.js';

export interface PushResult {
  readonly ok: boolean;
  /** The branch that was pushed — always the checked-out one; the model never names it. */
  readonly branch: string;
  /** True when this push CREATED the branch on the remote (allowed; creating the repo is not). */
  readonly createdRemoteBranch: boolean;
  /** True when the remote already had every commit — a no-op push, not a failure. */
  readonly upToDate: boolean;
  /** Structured, recoverable reason when ok === false. */
  readonly error?: string;
  /** What the model should do about `error` — for a missing repo, that means asking the user. */
  readonly hint?: string;
}

/**
 * Push the checked-out branch to `origin`, setting upstream. Never forces. Returns a structured,
 * recoverable result for every failure mode; never throws.
 */
export function pushCurrentBranch(projectPath: string): PushResult {
  // currentBranch: `git branch --show-current`, null when HEAD is detached.
  const branch = currentBranch(projectPath);
  if (branch === null) {
    return {
      ok: false,
      branch: '',
      createdRemoteBranch: false,
      upToDate: false,
      error: 'HEAD is detached, so there is no branch to push.',
      hint: 'Switch to a branch with git_branch before pushing.',
    };
  }

  // hasOrigin: `git remote` lists `origin` — false when the project was never given a destination.
  if (!hasOrigin(projectPath)) {
    return {
      ok: false,
      branch,
      createdRemoteBranch: false,
      upToDate: false,
      error: `this project has no '${REMOTE}' remote, so there is nowhere to push.`,
      hint:
        'You cannot create the repository yourself. Tell the user the work is committed and ready to ' +
        'push, and ask them to create the remote repository and add it as origin.',
    };
  }

  const push = runGit(projectPath, ['push', '-u', REMOTE, branch]);
  // git push reports its progress on stderr even when it succeeds, so both streams are evidence.
  const output = `${push.stdout}\n${push.stderr}`;

  if (!push.ok) {
    // isMissingRepository: git's three phrasings for "that repository is not there" — see its header.
    if (isMissingRepository(push.stderr)) {
      return {
        ok: false,
        branch,
        createdRemoteBranch: false,
        upToDate: false,
        error: `the '${REMOTE}' repository does not exist (or is not reachable), so '${branch}' cannot be pushed.`,
        hint:
          'You cannot create the repository yourself. Tell the user the work is committed and ready ' +
          'to push, and ask them to create it.',
      };
    }
    return {
      ok: false,
      branch,
      createdRemoteBranch: false,
      upToDate: false,
      error: `git push failed: ${push.stderr}`,
    };
  }

  return {
    ok: true,
    branch,
    createdRemoteBranch: output.includes('[new branch]'),
    upToDate: /everything up-to-date/i.test(output),
  };
}
