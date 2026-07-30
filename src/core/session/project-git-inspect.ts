// Read-only history inspection — backs the git_inspect tool: diff / log / show. Nothing here mutates
// anything.
//
// EVERY result is BOUNDED, which is the point. A phase can ask for the diff of a huge change or a log
// of a long history, and an unbounded answer would quietly eat the num_ctx budget the whole session
// is sized around — on one RTX 3060 that is the constraint everything else bends to. So diff and show
// truncate head+tail at REVIEW_DIFF_BUDGET (the figure the Reviewer's own diff already uses), and log
// is capped by COMMIT COUNT as well, because a log's cost is in its rows.
//
// The model cannot raise any of these limits; `count` only ever narrows.

import { truncateHeadTail } from '../../tools/truncate.js';
import { REVIEW_DIFF_BUDGET } from './project-git.js';
import { runGit } from './run-git.js';
import type { InspectResult } from './project-git-inspect.type.js';

/** Commits `log` returns when the caller does not say. */
export const DEFAULT_LOG_COUNT = 20;

/** Hard ceiling on `log` rows, whatever the caller asks for. */
export const MAX_LOG_COUNT = 100;

/**
 * Why `ref` is unusable, or null when it is fine. A leading '-' is the one that matters: it would be
 * read as an OPTION in the argv rather than as a revision, which is how a read-only tool would stop
 * being read-only.
 */
export function refError(ref: string): string | null {
  if (ref.trim() === '') return "'ref' must not be empty.";
  if (ref.startsWith('-')) return `'${ref}' is not a valid revision — it must not start with '-'.`;
  return null;
}

/** Bound `output` to `budget`, reporting whether anything was cut. */
function bounded(output: string, budget: number): InspectResult {
  const trimmed = output.trim();
  const cut = truncateHeadTail(trimmed, budget);
  return { ok: true, output: cut, truncated: cut.length !== trimmed.length };
}

/** True when the repo has a commit. A fresh `git init` has none, and `diff HEAD` fails there. */
function hasHead(projectPath: string): boolean {
  return runGit(projectPath, ['rev-parse', '--verify', 'HEAD']).ok;
}

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
  if (!hasHead(projectPath)) {
    return { ok: true, output: '', truncated: false }; // nothing is committed yet — nothing to diff against
  }
  const pathArgs = paths.length > 0 ? ['--', ...paths] : [];
  const diff = runGit(projectPath, ['--no-pager', 'diff', ref ?? 'HEAD', ...pathArgs]);
  if (!diff.ok) return { ok: false, output: '', truncated: false, error: `git diff failed: ${diff.stderr}` };
  return bounded(diff.stdout, budget);
}

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
  if (!hasHead(projectPath)) {
    return { ok: true, output: '', truncated: false }; // no commits yet
  }
  const clamped = Math.min(Math.max(Math.trunc(count), 1), MAX_LOG_COUNT);
  const pathArgs = paths.length > 0 ? ['--', ...paths] : [];
  const args = ['--no-pager', 'log', '--oneline', `-n${clamped}`, ...(ref === null ? [] : [ref]), ...pathArgs];
  const log = runGit(projectPath, args);
  if (!log.ok) return { ok: false, output: '', truncated: false, error: `git log failed: ${log.stderr}` };
  return bounded(log.stdout, budget);
}

/** One commit in full: its metadata, message and patch. `ref` is required — there is no default. */
export function inspectShow(projectPath: string, ref: string, budget: number = REVIEW_DIFF_BUDGET): InspectResult {
  const show = runGit(projectPath, ['--no-pager', 'show', ref]);
  if (!show.ok) return { ok: false, output: '', truncated: false, error: `git show failed: ${show.stderr}` };
  return bounded(show.stdout, budget);
}
