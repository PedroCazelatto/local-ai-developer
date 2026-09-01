// Restore a shelf into the working tree — the `pop` action of the git_stash tool.

import { findShelfRef } from './find-shelf-ref.js';
import { runGit } from './run-git.js';
import type { ShelfResult } from './shelf-result.type.js';

/** Restore `label` into the working tree and remove the shelf. Unknown label ⇒ recoverable refusal. */
export function popShelf(projectPath: string, label: string): ShelfResult {
  // findShelfRef: resolves `stash@{n}` by the `lad-shelf:` LABEL; null when there is no such shelf.
  const ref = findShelfRef(projectPath, label);
  if (ref === null) return { ok: false, label, error: `no shelf named '${label}'.` };
  const pop = runGit(projectPath, ['stash', 'pop', ref]);
  if (!pop.ok) {
    // The usual cause is a conflict against the current tree: git leaves the shelf in place, so the
    // model can fix the tree and pop again. Say so rather than reporting a bare failure.
    return { ok: false, label, error: `git stash pop failed (conflict with the current tree?): ${pop.stderr}` };
  }
  return { ok: true, label };
}
