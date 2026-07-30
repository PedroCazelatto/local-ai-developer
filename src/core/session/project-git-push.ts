// Model-facing push — backs the git_push tool. Deliberately takes NO arguments: it always pushes the
// CHECKED-OUT branch to `origin` with `-u`, and there is no force, no remote argument and no refspec
// for a model to get wrong.
//
// The asymmetry the task turns on:
//
// - A missing REMOTE BRANCH is fine. `-u` creates it, which is how a task branch first reaches the
//   remote.
// - A missing REPOSITORY is an ERROR. The model never creates a GitHub repository, so a push with no
//   destination fails with a recoverable message that tells it to ask the user to create the repo —
//   and the user does it. That is the whole point of distinguishing the two.

import { currentBranch } from './project-git-branch.js';
import { runGit } from './run-git.js';
import type { PushResult } from './project-git-push.type.js';

/** The remote every push targets. Not configurable by the model — see the file header. */
const REMOTE = 'origin';

/**
 * git's several ways of saying "that repository is not there". HTTPS answers "Repository not found",
 * SSH answers "Could not read from remote repository" after the host rejects it, and a bad path
 * answers "does not appear to be a git repository". All three mean the same thing to the model: the
 * destination does not exist and a human has to create it.
 */
function isMissingRepository(stderr: string): boolean {
  const text = stderr.toLowerCase();
  return (
    text.includes('repository not found') ||
    text.includes('does not appear to be a git repository') ||
    text.includes('could not read from remote repository')
  );
}

/** True when `origin` is configured at all. Its absence is the other half of "no destination". */
function hasOrigin(projectPath: string): boolean {
  return runGit(projectPath, ['remote'])
    .stdout.split('\n')
    .map((line) => line.trim())
    .includes(REMOTE);
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
