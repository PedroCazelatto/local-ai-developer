// The pathspec-scoped twin of capture-changed-files.ts: the real change behind EXACTLY these paths,
// which is what the commit-message writer reads — never the committing phase's description of it.

import { truncateHeadTail } from '../../tools/truncate.js';
import { hasHead } from './has-head.js';
import { porcelainPath } from './porcelain-path.js';
import { renderNewFile } from './render-new-file.js';
import { REVIEW_DIFF_BUDGET } from './review-diff-budget.js';
import { runGit } from './run-git.js';

/**
 * Bounded diff of EXACTLY `paths` — tracked edits via `git diff HEAD -- <paths>` plus the bodies of
 * any new (untracked) files among them, which `git diff` omits. This is what the commit-message
 * writer reads: the real change, never the committing phase's description of it. Mirrors
 * captureChangedFiles, but pathspec-scoped so a partial commit's message describes only its own files.
 */
export function diffPaths(projectPath: string, paths: readonly string[], budget: number = REVIEW_DIFF_BUDGET): string {
  if (paths.length === 0) return '';
  const statusLines = runGit(projectPath, ['status', '--porcelain', '-uall', '--', ...paths]).stdout
    .split('\n')
    .filter((l) => l.trim() !== '');
  // porcelainPath: strips the 2-char XY status, and keeps the NEW path of a rename.
  const untracked = statusLines.filter((l) => l.startsWith('??')).map(porcelainPath).filter((p) => p !== '');

  // hasHead: `git rev-parse --verify HEAD` — false on a repo with no commit yet, where diff HEAD fails.
  const trackedDiff = hasHead(projectPath) ? runGit(projectPath, ['--no-pager', 'diff', 'HEAD', '--', ...paths]).stdout.trim() : '';
  // renderNewFile: reads an untracked file off the host fs as a `--- new file: <rel> ---` block.
  const newFiles = untracked.map((p) => renderNewFile(projectPath, p)).filter((s) => s !== '');

  // truncateHeadTail: keeps the head and the tail of the text and elides the middle, to fit `budget`.
  return truncateHeadTail([trackedDiff, ...newFiles].filter((s) => s !== '').join('\n\n'), budget);
}
