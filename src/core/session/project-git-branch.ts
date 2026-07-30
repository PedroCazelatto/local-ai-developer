// Model-facing branches — backs the git_branch tool: create / switch / list, inside the project repo
// only. This is what makes the one-branch-per-task convention possible: the Worker puts itself on
// `task/<id>` before it writes code, and the Reviewer commits onto whatever branch it finds.
//
// The dirty-tree rule differs between the two mutating actions, and the difference is deliberate:
//
// - CREATE is allowed on a dirty tree. `git checkout -b` carries uncommitted changes onto the new
//   branch without losing any of them, so a Worker that started writing before it branched loses
//   nothing by branching late.
// - SWITCH to an EXISTING branch is refused on a dirty tree. There git either refuses itself (the
//   change would be overwritten) or silently carries the work onto a branch it does not belong to.
//   Refusing with a recoverable message keeps the model's picture of the repo true — it commits or
//   shelves first, deliberately, and nothing moves behind its back.
//
// Creating a branch that already exists is therefore a SWITCH, and inherits the switch rule.

import { isWorkingTreeDirty } from './project-git.js';
import { runGit } from './run-git.js';
import type { BranchList, BranchResult } from './project-git-branch.type.js';

/** The checked-out branch, or null when HEAD is detached. Empty output means a detached HEAD. */
export function currentBranch(projectPath: string): string | null {
  const shown = runGit(projectPath, ['branch', '--show-current']);
  if (!shown.ok) return null;
  const branch = shown.stdout.trim();
  return branch === '' ? null : branch;
}

/** Every local branch, plus which one is checked out. */
export function listBranches(projectPath: string): BranchList {
  const listed = runGit(projectPath, ['branch', '--format=%(refname:short)']);
  const branches = listed.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  return { branches, current: currentBranch(projectPath) };
}

/** True when a local branch by that name already exists. */
export function branchExists(projectPath: string, name: string): boolean {
  return runGit(projectPath, ['rev-parse', '--verify', '--quiet', `refs/heads/${name}`]).ok;
}

/**
 * Why `name` is not a usable branch name, or null when it is fine. The three JS-side rejections come
 * first because they are the ones git itself would not catch as NAMES: a leading '-' would be read as
 * an option in the argv, and `@{...}` is git's own shorthand syntax (`@{-1}` means "the branch I was
 * on"), which would resolve to something other than what the model spelled.
 */
export function branchNameError(projectPath: string, name: string): string | null {
  if (name === '') return "'name' must not be empty.";
  if (name.startsWith('-')) return `'${name}' is not a valid branch name — it must not start with '-'.`;
  if (name.includes('@{')) return `'${name}' is not a valid branch name — '@{' is git's own reference shorthand.`;
  // git is the authority on the rest of the rules (no "..", no trailing ".lock", no control chars).
  if (!runGit(projectPath, ['check-ref-format', '--branch', name]).ok) {
    return `'${name}' is not a valid git branch name.`;
  }
  return null;
}

/**
 * Create `name` and check it out. If the branch is already there this is a switch instead — reported
 * as `existed: true` so a resumed task, a later fix round, or a re-run costs no wasted turn and
 * cannot leave the model on the wrong branch by fumbling create-versus-switch.
 *
 * Uncommitted work carries onto a genuinely new branch; see the file header.
 */
export function createBranch(projectPath: string, name: string): BranchResult {
  if (branchExists(projectPath, name)) {
    const switched = switchBranch(projectPath, name);
    return { ...switched, existed: true };
  }
  const created = runGit(projectPath, ['checkout', '-b', name]);
  if (!created.ok) {
    return { ok: false, branch: name, existed: false, error: `git checkout -b failed: ${created.stderr}` };
  }
  return { ok: true, branch: name, existed: false };
}

/**
 * Check out an EXISTING branch. Refuses a dirty working tree (see the file header) and refuses an
 * unknown branch — both recoverable, both naming the fix.
 */
export function switchBranch(projectPath: string, name: string): BranchResult {
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
