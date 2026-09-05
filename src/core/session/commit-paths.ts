// The accept-commit half of host-side git (V2/03). Stages the ACCEPTED set only — never `git add -A` —
// and refuses any path that escapes the project repo, which is the guard that keeps a global-rule edit
// (the orchestrator's own rules/, which lives OUTSIDE every project) from ever being auto-committed.

import path from 'node:path';

import { runGit } from './run-git.js';

export interface CommitResult {
  readonly committed: boolean;
  readonly sha?: string;
  /** Files actually staged + committed (empty when committed === false). */
  readonly files: string[];
  /** Structured, recoverable reason when committed === false. */
  readonly error?: string;
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
