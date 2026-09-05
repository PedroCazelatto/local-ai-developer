// What the Worker changed since the last commit, as the Reviewer sees it. Host-side git for the ACTIVE
// project: the orchestrator is the only host-side process (CLAUDE.md), so this runs git on the HOST
// against projects/<name> — NOT in a container, because the node:24-slim sandbox ships no git and
// diff-capture is an orchestrator action, never a model tool call. Non-mutating, and BOUNDED.

import { truncateHeadTail } from '../../tools/truncate.js';
import { hasHead } from './has-head.js';
import type { ChangedPaths } from './list-changed-paths.js';
import { porcelainPath } from './porcelain-path.js';
import { renderNewFile } from './render-new-file.js';
import { REVIEW_DIFF_BUDGET } from './review-diff-budget.js';
import { runGit } from './run-git.js';

export interface ChangedFiles extends ChangedPaths {
  /** Bounded diff body (tracked changes + new-file contents), truncated to REVIEW_DIFF_BUDGET. */
  readonly diff: string;
  /** True when the diff was truncated to fit the budget. */
  readonly truncated: boolean;
}

/**
 * Capture what the Worker changed since the last commit: the porcelain file list (always) plus a
 * BOUNDED diff body — `git diff HEAD` for tracked edits, and the contents of new untracked files
 * (which `git diff` omits) appended, non-mutatingly. The Reviewer can read_file anything the trimmed
 * diff drops. `-uall` lists untracked files individually (not just their directory).
 */
export function captureChangedFiles(projectPath: string, budget: number = REVIEW_DIFF_BUDGET): ChangedFiles {
  const status = runGit(projectPath, ['status', '--porcelain', '-uall']).stdout.replace(/\s+$/, '');
  const lines = status.split('\n').filter((l) => l.trim() !== '');
  // porcelainPath: strips the 2-char XY status, and keeps the NEW path of a rename.
  const files = lines.map(porcelainPath).filter((p) => p !== '');
  const untracked = lines.filter((l) => l.startsWith('??')).map(porcelainPath).filter((p) => p !== '');

  // hasHead: `git rev-parse --verify HEAD` — false on a repo with no commit yet, where diff HEAD fails.
  const trackedDiff = hasHead(projectPath) ? runGit(projectPath, ['--no-pager', 'diff', 'HEAD']).stdout.trim() : '';
  // renderNewFile: reads an untracked file off the host fs as a `--- new file: <rel> ---` block.
  const newFiles = untracked.map((p) => renderNewFile(projectPath, p)).filter((s) => s !== '');

  const combined = [trackedDiff, ...newFiles].filter((s) => s !== '').join('\n\n');
  // truncateHeadTail: keeps the head and the tail of the text and elides the middle, to fit `budget`.
  const diff = truncateHeadTail(combined, budget);
  return { status, files, diff, truncated: diff.length !== combined.length };
}
