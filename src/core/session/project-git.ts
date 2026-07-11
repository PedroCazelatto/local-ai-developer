// Host-side git for the ACTIVE project (V2/02 diff-capture + V2/03 accept-commit). The orchestrator
// is the only host-side process (CLAUDE.md), so these run git on the HOST against projects/<name> —
// exactly like run.ts's showTouchedFiles — NOT in a container: the node:24-slim sandbox ships no
// git, and diff-capture + commit are orchestrator actions gated on the user's accept, never model
// tool calls. Every call passes an explicit `-C <projectPath>` with an argv (no shell), so nothing
// can escape the project repo.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { truncateHeadTail } from '../../tools/truncate.js';

/** Char budget for the diff fed to the Reviewer — bounded so a huge change can't blow past num_ctx. */
export const REVIEW_DIFF_BUDGET = 12_000;

export interface ChangedFiles {
  /** `git status --porcelain` (the changed-file list). "" when the tree is clean. */
  readonly status: string;
  /** Project-relative paths of every changed / untracked file — the set staged on accept. */
  readonly files: string[];
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

interface GitRun {
  readonly ok: boolean;
  readonly stdout: string;
  readonly stderr: string;
}

/** Run one git command against the project repo. Never throws — a non-zero exit is captured. */
function runGit(projectPath: string, args: readonly string[]): GitRun {
  try {
    const stdout = execFileSync('git', ['-C', projectPath, ...args], {
      encoding: 'utf-8',
      maxBuffer: 64 * 1024 * 1024,
    });
    return { ok: true, stdout, stderr: '' };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return { ok: false, stdout: e.stdout ?? '', stderr: (e.stderr ?? e.message ?? 'git failed').trim() };
  }
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

/**
 * Discard every uncommitted change, restoring the tree to the last commit: revert tracked edits
 * (`reset --hard HEAD`) and remove untracked files (`clean -fd`). Used after a task is BLOCKED (V3/02)
 * so the NEXT task's review stays isolated — the blocked Worker's attempt is throwaway (a fresh Worker
 * re-runs the task after the user answers). `-e .orchestrator` keeps session state (the just-written
 * `raised` row + the audit log) even if a project forgot to git-ignore it; `clean` without `-x` also
 * never removes git-ignored deps (node_modules, dist). Never throws — a git failure just leaves the
 * tree dirty, and the /run dirty-tree guard then halts before the next task (the safe fallback).
 */
export function discardWorkingTreeChanges(projectPath: string): void {
  runGit(projectPath, ['reset', '--hard', 'HEAD']);
  runGit(projectPath, ['clean', '-fd', '-e', '.orchestrator']);
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
