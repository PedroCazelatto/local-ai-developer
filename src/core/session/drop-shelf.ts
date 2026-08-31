// Discard a shelf without restoring it — the `drop` action of the git_stash tool. It can only ever
// reach a `lad-shelf:` stash, never the task loop's record of a failed attempt.

import { findShelfRef } from './find-shelf-ref.js';
import { runGit } from './run-git.js';
import type { ShelfResult } from './types.js';

/** Discard `label` without restoring it. Unknown label ⇒ recoverable refusal. */
export function dropShelf(projectPath: string, label: string): ShelfResult {
  // findShelfRef: resolves `stash@{n}` by the `lad-shelf:` LABEL; null when there is no such shelf.
  const ref = findShelfRef(projectPath, label);
  if (ref === null) return { ok: false, label, error: `no shelf named '${label}'.` };
  const drop = runGit(projectPath, ['stash', 'drop', ref]);
  if (!drop.ok) return { ok: false, label, error: `git stash drop failed: ${drop.stderr}` };
  return { ok: true, label };
}
