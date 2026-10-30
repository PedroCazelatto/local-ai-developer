// The model's view of its own shelves. This is the ONLY place the shelf list is derived, so nothing
// downstream can see a task-loop stash: the filter to `lad-shelf:` happens here and only here.

import { runGit } from './run-git.js';
import { SHELF_LABEL_PREFIX } from './shelf-label.js';
import { FIELD_SEPARATOR } from './stash-list-separator.js';

/** One `lad-shelf:` stash, as the model sees it. Task-loop stashes never appear here. */
export interface Shelf {
  /** The model's own label, with the `lad-shelf:` prefix stripped. */
  readonly label: string;
  /** The branch the work was stashed from. */
  readonly branch: string;
  /** Relative age, e.g. "2 hours ago" — enough to tell a stale shelf from a fresh one. */
  readonly when: string;
}

/**
 * Every `lad-shelf:` stash currently in the repo, newest first (git's own stash order). Task-loop
 * stashes are filtered out here — this is the ONLY place the shelf list is derived, so nothing
 * downstream can see one.
 *
 * `%gd` is the stash ref, `%gs` its reflog subject ("On <branch>: <message>"), `%cr` its relative
 * date; they are joined by a unit separator so a branch name containing ": " cannot split the parse.
 */
export function listShelves(projectPath: string): Shelf[] {
  const format = `--format=%gd${FIELD_SEPARATOR}%gs${FIELD_SEPARATOR}%cr`;
  const list = runGit(projectPath, ['--no-pager', 'stash', 'list', format]);
  if (!list.ok) return [];

  const shelves: Shelf[] = [];
  for (const line of list.stdout.split('\n')) {
    if (line.trim() === '') continue;
    const [, subject = '', when = ''] = line.split(FIELD_SEPARATOR);
    // "On <branch>: <message>" — or "WIP on <branch>: ..." for a stash saved with no message, which
    // by definition is not a shelf.
    const parsed = /^On (.+?): (.+)$/.exec(subject.trimEnd());
    if (parsed === null) continue;
    const [, branch = '', message = ''] = parsed;
    if (!message.startsWith(SHELF_LABEL_PREFIX)) continue; // a task-loop stash, or a hand-made one
    shelves.push({ label: message.slice(SHELF_LABEL_PREFIX.length), branch, when });
  }
  return shelves;
}
