// Host-side git for the ACTIVE project (V2/02 diff-capture + V2/03 accept-commit). The orchestrator
// is the only host-side process (CLAUDE.md), so these run git on the HOST against projects/<name> —
// exactly like run.ts's showTouchedFiles — NOT in a container: the node:24-slim sandbox ships no
// git, and diff-capture + commit are orchestrator actions gated on the user's accept, never model
// tool calls. Every call goes through runGit (run-git.ts), which pins git to the project repo with an
// explicit `-C <projectPath>` and an argv, no shell — so nothing can escape it. The model-facing git
// tools (stash / branch / push / inspect) live in the project-git-*.ts siblings and share that same
// invocation.

import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { truncateHeadTail } from '../../tools/truncate.js';
import { runGit } from './run-git.js';

/** Char budget for the diff fed to the Reviewer — bounded so a huge change can't blow past num_ctx. */
export const REVIEW_DIFF_BUDGET = 12_000;

/** The uncommitted-file set on its own — no diff body, so listing costs nothing to assemble. */
export interface ChangedPaths {
  /** `git status --porcelain` (the changed-file list). "" when the tree is clean. */
  readonly status: string;
  /** Project-relative paths of every changed / untracked file — the set staged on accept. */
  readonly files: string[];
}

export interface ChangedFiles extends ChangedPaths {
  /** Bounded diff body (tracked changes + new-file contents), truncated to REVIEW_DIFF_BUDGET. */
  readonly diff: string;
  /** True when the diff was truncated to fit the budget. */
  readonly truncated: boolean;
}

export interface CommitResult {
  readonly committed: boolean;
  readonly sha?: string;
  /** Files actually staged + committed (empty when committed === false). */
  readonly files: string[];
  /** Structured, recoverable reason when committed === false. */
  readonly error?: string;
}

/** Strip a `git status --porcelain` line to its project-relative path (handles rename + quoting). */
function porcelainPath(line: string): string {
  let p = line.slice(3); // after the 2-char XY status + a space
  const arrow = p.indexOf(' -> ');
  if (arrow !== -1) p = p.slice(arrow + 4); // a rename shows "old -> new"; keep the new path
  return p.trim().replace(/^"(.*)"$/, '$1');
}

/** True when the project working tree has ANY uncommitted change (tracked edits OR untracked files). */
export function isWorkingTreeDirty(projectPath: string): boolean {
  return runGit(projectPath, ['status', '--porcelain']).stdout.trim() !== '';
}

// Stash label prefix: a task-keyed `git stash` message so a failed attempt is recoverable by task id
// (the stash message IS the durable record — no separate store). One stash per task at a time.
//
// This prefix is the TASK LOOP'S and nothing else may touch it. The model's own stash tool uses a
// disjoint `lad-shelf:` prefix (project-git-stash.ts) precisely so a model can never pop or drop the
// record Retro and the user depend on — the two namespaces must never be merged.
const STASH_LABEL_PREFIX = 'lad-stash:';

/** The `stash@{n}` ref of the task's labeled stash, or null if it has none (found by message, not index,
 * so it survives other stashes pushed after it). */
function findTaskStashRef(projectPath: string, taskId: string): string | null {
  const label = `${STASH_LABEL_PREFIX}${taskId}`;
  for (const line of runGit(projectPath, ['stash', 'list']).stdout.split('\n')) {
    // `git stash list` prints `stash@{n}: On <branch>: <message>` — the message is the trailing text.
    const ref = /^(stash@\{\d+\})/.exec(line)?.[1];
    if (ref !== undefined && line.trimEnd().endsWith(`: ${label}`)) return ref;
  }
  return null;
}

/**
 * Stash the current uncommitted attempt under a task-keyed label so it is preserved (not discarded) when
 * a task ends non-passing — the Worker NEVER reuses it (a fresh Worker redoes the task from scratch); it
 * exists so Retro can inspect what went wrong (blocked) or the user can review it (escalated). Includes
 * untracked files (`-u`) but never git-ignored state (`.orchestrator/`). Supersedes any prior stash for
 * the task (keeps only the latest attempt). Returns the stable label, or null if there was nothing to
 * stash. Never throws — a git failure just returns null (the caller falls back to a dirty/clean tree).
 */
export function stashTaskAttempt(projectPath: string, taskId: string): string | null {
  dropTaskStash(projectPath, taskId); // supersede a prior attempt so at most one stash per task exists
  const label = `${STASH_LABEL_PREFIX}${taskId}`;
  const push = runGit(projectPath, ['stash', 'push', '-u', '-m', label]);
  // "No local changes to save" exits 0 and creates NO stash (e.g. an escalation with an empty diff).
  if (!push.ok || /no local changes/i.test(push.stdout)) return null;
  return findTaskStashRef(projectPath, taskId) === null ? null : label;
}

/**
 * The task's stashed attempt as a bounded diff (tracked edits + new files via `--include-untracked`),
 * for Retro to read what the failed Worker produced — or null if the task has no stash. Truncated to
 * REVIEW_DIFF_BUDGET so a huge attempt can't blow past num_ctx when fed to the Retro window.
 */
export function readTaskStashDiff(projectPath: string, taskId: string, budget: number = REVIEW_DIFF_BUDGET): string | null {
  const ref = findTaskStashRef(projectPath, taskId);
  if (ref === null) return null;
  const show = runGit(projectPath, ['--no-pager', 'stash', 'show', '-p', '--include-untracked', ref]);
  const diff = show.stdout.trim();
  return diff === '' ? null : truncateHeadTail(diff, budget);
}

/** Drop the task's labeled stash if it has one (a no-op otherwise). Never throws. */
export function dropTaskStash(projectPath: string, taskId: string): void {
  const ref = findTaskStashRef(projectPath, taskId);
  if (ref !== null) runGit(projectPath, ['stash', 'drop', ref]);
}

/** Render a new (untracked) file as a diff-style block, reading its content from the host fs. */
function renderNewFile(projectPath: string, rel: string): string {
  const abs = path.join(projectPath, rel);
  try {
    if (!existsSync(abs) || statSync(abs).isDirectory()) return '';
    return `--- new file: ${rel} ---\n${readFileSync(abs, 'utf-8')}`;
  } catch {
    return `--- new file: ${rel} --- (unreadable)`;
  }
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
  const files = lines.map(porcelainPath).filter((p) => p !== '');
  const untracked = lines.filter((l) => l.startsWith('??')).map(porcelainPath).filter((p) => p !== '');

  const hasHead = runGit(projectPath, ['rev-parse', '--verify', 'HEAD']).ok;
  const trackedDiff = hasHead ? runGit(projectPath, ['--no-pager', 'diff', 'HEAD']).stdout.trim() : '';
  const newFiles = untracked.map((p) => renderNewFile(projectPath, p)).filter((s) => s !== '');

  const combined = [trackedDiff, ...newFiles].filter((s) => s !== '').join('\n\n');
  const diff = truncateHeadTail(combined, budget);
  return { status, files, diff, truncated: diff.length !== combined.length };
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
    .map(porcelainPath)
    .filter((p) => p !== '');
  return { status, files };
}

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
  const untracked = statusLines.filter((l) => l.startsWith('??')).map(porcelainPath).filter((p) => p !== '');

  const hasHead = runGit(projectPath, ['rev-parse', '--verify', 'HEAD']).ok;
  const trackedDiff = hasHead ? runGit(projectPath, ['--no-pager', 'diff', 'HEAD', '--', ...paths]).stdout.trim() : '';
  const newFiles = untracked.map((p) => renderNewFile(projectPath, p)).filter((s) => s !== '');

  return truncateHeadTail([trackedDiff, ...newFiles].filter((s) => s !== '').join('\n\n'), budget);
}

/**
 * Stage exactly `paths` and commit them with `message`, in the project repo, on the host. Stages the
 * ACCEPTED set only (never `git add -A`) so nothing outside the reviewed change is swept in. Refuses
 * any path that escapes the project repo — the guard that keeps a global-rule edit (the orchestrator's
 * own rules/, which lives OUTSIDE the project) from ever being auto-committed. Returns a structured
 * recoverable result; never throws.
 */
export function commitPaths(projectPath: string, message: string, paths: readonly string[]): CommitResult {
  if (paths.length === 0) {
    return { committed: false, files: [], error: 'nothing to commit (the accepted changed-files set is empty).' };
  }
  const root = path.resolve(projectPath);
  for (const rel of paths) {
    const resolved = path.resolve(root, rel);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      return {
        committed: false,
        files: [],
        error:
          `refused to stage '${rel}': it escapes the project repo. Global instruction edits (the ` +
          `orchestrator's rules/) are never auto-committed — review before continuing.`,
      };
    }
  }

  const add = runGit(projectPath, ['add', '--', ...paths]);
  if (!add.ok) {
    return { committed: false, files: [], error: `git add failed: ${add.stderr}` };
  }
  const commit = runGit(projectPath, ['commit', '-m', message]);
  if (!commit.ok) {
    return { committed: false, files: [], error: `git commit failed (nothing staged?): ${commit.stderr}` };
  }
  const sha = runGit(projectPath, ['rev-parse', '--short', 'HEAD']).stdout.trim();
  return { committed: true, sha: sha === '' ? undefined : sha, files: [...paths] };
}
