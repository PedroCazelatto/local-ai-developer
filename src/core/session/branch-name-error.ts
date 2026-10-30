// Validation for a branch name the MODEL chose, before it reaches an argv.

import { runGit } from './run-git.js';

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
