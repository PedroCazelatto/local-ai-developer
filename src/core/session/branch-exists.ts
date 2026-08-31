// Does this local branch exist? The question create/switch both turn on: creating a branch that is
// already there is a SWITCH, and switching to one that is not there is a recoverable refusal.

import { runGit } from './run-git.js';

/** True when a local branch by that name already exists. */
export function branchExists(projectPath: string, name: string): boolean {
  return runGit(projectPath, ['rev-parse', '--verify', '--quiet', `refs/heads/${name}`]).ok;
}
