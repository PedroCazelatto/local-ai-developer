// Does the project repo have a commit yet? A fresh `git init` has none, and anything that diffs
// against HEAD fails there — so the inspection reads check first and answer "nothing to show" rather
// than surfacing git's error as a tool failure.

import { runGit } from './run-git.js';

/** True when the repo has a commit. A fresh `git init` has none, and `diff HEAD` fails there. */
export function hasHead(projectPath: string): boolean {
  return runGit(projectPath, ['rev-parse', '--verify', 'HEAD']).ok;
}
