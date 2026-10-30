// Check out an EXISTING branch — the half of the model-facing branch pair that REFUSES a dirty tree.
//
// The asymmetry with create-branch.ts is deliberate. Switching to an existing branch on a dirty tree
// is where git either refuses itself (the change would be overwritten) or silently carries the work
// onto a branch it does not belong to. Refusing with a recoverable message keeps the model's picture
// of the repo true — it commits or shelves first, deliberately, and nothing moves behind its back.

import { branchExists } from './branch-exists.js';
import type { BranchResult } from './branch-result.type.js';
import { isWorkingTreeDirty } from './is-working-tree-dirty.js';
import { runGit } from './run-git.js';

/**
 * Check out an EXISTING branch. Refuses a dirty working tree (see the file header) and refuses an
 * unknown branch — both recoverable, both naming the fix.
 */
export function switchBranch(projectPath: string, name: string): BranchResult {
  // branchExists: `git rev-parse --verify --quiet refs/heads/<name>`.
  if (!branchExists(projectPath, name)) {
    return { ok: false, branch: name, existed: false, error: `no local branch named '${name}'.` };
  }
  // isWorkingTreeDirty: `git status --porcelain` is non-empty — ANY tracked edit or untracked file.
  if (isWorkingTreeDirty(projectPath)) {
    return {
      ok: false,
      branch: name,
      existed: true,
      error:
        `the working tree has uncommitted changes, so switching to '${name}' would carry them onto a ` +
        `branch they do not belong to.`,
    };
  }
  const checkout = runGit(projectPath, ['checkout', name]);
  if (!checkout.ok) {
    return { ok: false, branch: name, existed: true, error: `git checkout failed: ${checkout.stderr}` };
  }
  return { ok: true, branch: name, existed: true };
}
