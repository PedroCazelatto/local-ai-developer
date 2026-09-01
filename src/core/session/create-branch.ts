// Create a branch and check it out — what makes the one-branch-per-task convention possible: the
// Worker puts itself on `task/<id>` before it writes code, and the Reviewer commits onto whatever
// branch it finds.
//
// CREATE is allowed on a dirty tree, unlike switch-branch.ts. `git checkout -b` carries uncommitted
// changes onto the new branch without losing any of them, so a Worker that started writing before it
// branched loses nothing by branching late. Creating a branch that already EXISTS is therefore a
// switch, and inherits the switch rule instead.

import { branchExists } from './branch-exists.js';
import type { BranchResult } from './branch-result.type.js';
import { runGit } from './run-git.js';
import { switchBranch } from './switch-branch.js';

/**
 * Create `name` and check it out. If the branch is already there this is a switch instead — reported
 * as `existed: true` so a resumed task, a later fix round, or a re-run costs no wasted turn and
 * cannot leave the model on the wrong branch by fumbling create-versus-switch.
 *
 * Uncommitted work carries onto a genuinely new branch; see the file header.
 */
export function createBranch(projectPath: string, name: string): BranchResult {
  // branchExists: `git rev-parse --verify --quiet refs/heads/<name>`.
  if (branchExists(projectPath, name)) {
    // switchBranch: checks out an existing branch, refusing a dirty tree with a recoverable message.
    const switched = switchBranch(projectPath, name);
    return { ...switched, existed: true };
  }
  const created = runGit(projectPath, ['checkout', '-b', name]);
  if (!created.ok) {
    return { ok: false, branch: name, existed: false, error: `git checkout -b failed: ${created.stderr}` };
  }
  return { ok: true, branch: name, existed: false };
}
