// Shelve the working tree under a label the model chose — the `save` action of the git_stash tool.

import { findShelfRef } from './find-shelf-ref.js';
import { runGit } from './run-git.js';
import { SHELF_LABEL_PREFIX } from './shelf-label.js';
import type { ShelfResult } from './types.js';

/**
 * Shelve the whole uncommitted working tree under `label`. Includes untracked files (`-u`) but never
 * git-ignored state, so `.orchestrator/` stays put.
 *
 * Refuses to reuse a live label rather than superseding it: the task loop's own stash supersedes
 * because it keeps only the latest attempt, but here a silent overwrite would destroy work the model
 * believes it still has. Refuses a clean tree too — "saved" with nothing in it would be a lie the
 * model then tries to pop.
 */
export function saveShelf(projectPath: string, label: string): ShelfResult {
  // findShelfRef: resolves `stash@{n}` by the `lad-shelf:` LABEL; null when there is no such shelf.
  if (findShelfRef(projectPath, label) !== null) {
    return { ok: false, label, error: `a shelf named '${label}' already exists — pop it, drop it, or choose another label.` };
  }
  const push = runGit(projectPath, ['stash', 'push', '-u', '-m', `${SHELF_LABEL_PREFIX}${label}`]);
  if (!push.ok) {
    return { ok: false, label, error: `git stash push failed: ${push.stderr}` };
  }
  // "No local changes to save" exits 0 and creates NO stash — a clean tree, not a failure of git.
  if (findShelfRef(projectPath, label) === null) {
    return { ok: false, label, error: 'nothing to stash — the working tree is clean.' };
  }
  return { ok: true, label };
}
