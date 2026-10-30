// The checked-out branch. Every model-facing branch operation reads it from here rather than parsing
// `git status`, so "which branch am I on" has exactly one answer in the codebase.

import { runGit } from './run-git.js';

/** The checked-out branch, or null when HEAD is detached. Empty output means a detached HEAD. */
export function currentBranch(projectPath: string): string | null {
  const shown = runGit(projectPath, ['branch', '--show-current']);
  if (!shown.ok) return null;
  const branch = shown.stdout.trim();
  return branch === '' ? null : branch;
}
