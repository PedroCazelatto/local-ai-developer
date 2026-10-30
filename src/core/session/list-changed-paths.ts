// The uncommitted-file set with NO diff body — cheap enough for the Reviewer to re-read between its
// own partial commits. Host-side git (the node:24-slim sandbox ships none), and it reads no file.

import { porcelainPath } from './porcelain-path.js';
import { runGit } from './run-git.js';

/** The uncommitted-file set on its own — no diff body, so listing costs nothing to assemble. */
export interface ChangedPaths {
  /** `git status --porcelain` (the changed-file list). "" when the tree is clean. */
  readonly status: string;
  /** Project-relative paths of every changed / untracked file — the set staged on accept. */
  readonly files: string[];
}

/**
 * The uncommitted-file set with NO diff body — what `list_changes` shows a phase, and what the
 * Reviewer window re-reads after each of its partial commits to know what is still outstanding.
 * Same porcelain parse as captureChangedFiles, without reading any file content.
 */
export function listChangedPaths(projectPath: string): ChangedPaths {
  const status = runGit(projectPath, ['status', '--porcelain', '-uall']).stdout.replace(/\s+$/, '');
  const files = status
    .split('\n')
    .filter((l) => l.trim() !== '')
    // porcelainPath: strips the 2-char XY status, and keeps the NEW path of a rename.
    .map(porcelainPath)
    .filter((p) => p !== '');
  return { status, files };
}
