// The local branch list, for the git_branch tool's `list` action.

import { currentBranch } from './current-branch.js';
import { runGit } from './run-git.js';

/** The branch list, with the checked-out one called out so the model never has to infer it. */
export interface BranchList {
  readonly branches: string[];
  /** The checked-out branch, or null when HEAD is detached. */
  readonly current: string | null;
}

/** Every local branch, plus which one is checked out. */
export function listBranches(projectPath: string): BranchList {
  const listed = runGit(projectPath, ['branch', '--format=%(refname:short)']);
  const branches = listed.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  // currentBranch: `git branch --show-current`, null when HEAD is detached.
  return { branches, current: currentBranch(projectPath) };
}
