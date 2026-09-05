// Read-only history inspection — the `log` action of the git_inspect tool. Bounded twice over: by
// COMMIT COUNT, because a log's cost is in its rows, and by the shared char budget on top.

import { boundInspectOutput } from './bound-inspect-output.js';
import { hasHead } from './has-head.js';
import { MAX_LOG_COUNT } from './inspect-log-count.js';
import { REVIEW_DIFF_BUDGET } from './review-diff-budget.js';
import { runGit } from './run-git.js';
import type { InspectResult } from './types.js';

/**
 * One line per commit, newest first — `<short sha> <subject>`. `count` is clamped into
 * [1, MAX_LOG_COUNT]; `ref` starts the walk somewhere other than HEAD; `paths` narrows it to the
 * commits that touched those files.
 */
export function inspectLog(
  projectPath: string,
  ref: string | null,
  paths: readonly string[],
  count: number,
  budget: number = REVIEW_DIFF_BUDGET,
): InspectResult {
  // hasHead: `git rev-parse --verify HEAD` — false on a repo with no commit yet.
  if (!hasHead(projectPath)) {
    return { ok: true, output: '', truncated: false }; // no commits yet
  }
  const clamped = Math.min(Math.max(Math.trunc(count), 1), MAX_LOG_COUNT);
  const pathArgs = paths.length > 0 ? ['--', ...paths] : [];
  const args = ['--no-pager', 'log', '--oneline', `-n${clamped}`, ...(ref === null ? [] : [ref]), ...pathArgs];
  const log = runGit(projectPath, args);
  if (!log.ok) return { ok: false, output: '', truncated: false, error: `git log failed: ${log.stderr}` };
  // boundInspectOutput: head+tail truncation to `budget`, flagging whether anything was cut.
  return boundInspectOutput(log.stdout, budget);
}
