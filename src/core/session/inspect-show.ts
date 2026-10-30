// Read-only history inspection — the `show` action of the git_inspect tool. Bounded like its two
// siblings; the model cannot raise the limit.

import { boundInspectOutput } from './bound-inspect-output.js';
import type { InspectResult } from './inspect-result.type.js';
import { REVIEW_DIFF_BUDGET } from './review-diff-budget.js';
import { runGit } from './run-git.js';

/** One commit in full: its metadata, message and patch. `ref` is required — there is no default. */
export function inspectShow(projectPath: string, ref: string, budget: number = REVIEW_DIFF_BUDGET): InspectResult {
  const show = runGit(projectPath, ['--no-pager', 'show', ref]);
  if (!show.ok) return { ok: false, output: '', truncated: false, error: `git show failed: ${show.stderr}` };
  // boundInspectOutput: head+tail truncation to `budget`, flagging whether anything was cut.
  return boundInspectOutput(show.stdout, budget);
}
