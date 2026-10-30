// Read-only history inspection — the `diff` action of the git_inspect tool. Nothing here mutates
// anything, and the result is BOUNDED: a phase can ask for the diff of a huge change, and an
// unbounded answer would quietly eat the num_ctx budget the whole session is sized around.

import { boundInspectOutput } from './bound-inspect-output.js';
import { hasHead } from './has-head.js';
import type { InspectResult } from './inspect-result.type.js';
import { REVIEW_DIFF_BUDGET } from './review-diff-budget.js';
import { runGit } from './run-git.js';

/**
 * Uncommitted changes against `ref` (default HEAD), optionally narrowed to `paths`. Unlike
 * captureChangedFiles this does NOT append the bodies of untracked files: this is the model's own
 * inspection tool, and a new file is one read_file away.
 */
export function inspectDiff(
  projectPath: string,
  ref: string | null,
  paths: readonly string[],
  budget: number = REVIEW_DIFF_BUDGET,
): InspectResult {
  // hasHead: `git rev-parse --verify HEAD` — false on a repo with no commit yet.
  if (!hasHead(projectPath)) {
    return { ok: true, output: '', truncated: false }; // nothing is committed yet — nothing to diff against
  }
  const pathArgs = paths.length > 0 ? ['--', ...paths] : [];
  const diff = runGit(projectPath, ['--no-pager', 'diff', ref ?? 'HEAD', ...pathArgs]);
  if (!diff.ok) return { ok: false, output: '', truncated: false, error: `git diff failed: ${diff.stderr}` };
  // boundInspectOutput: head+tail truncation to `budget`, flagging whether anything was cut.
  return boundInspectOutput(diff.stdout, budget);
}
