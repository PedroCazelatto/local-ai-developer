// Resolve a shelf by the LABEL the model chose, never by `stash@{n}`: an index shifts the moment
// anything else is stashed, and the task loop stashes on its own schedule, so an index the model read
// one turn ago can point at a different stash by the next.
//
// It can only ever match a `lad-shelf:` entry, which is what keeps a task-loop stash unreachable from
// the model's pop and drop.

import { runGit } from './run-git.js';
import { SHELF_LABEL_PREFIX } from './shelf-label.js';
import { FIELD_SEPARATOR } from './stash-list-separator.js';

/**
 * The `stash@{n}` ref carrying `label`, or null when the shelf does not exist. Resolved by MESSAGE,
 * so it stays correct after another stash is pushed — and it can only ever match a `lad-shelf:` entry,
 * which is what keeps a task-loop stash unreachable from here.
 */
export function findShelfRef(projectPath: string, label: string): string | null {
  const format = `--format=%gd${FIELD_SEPARATOR}%gs`;
  const wanted = `${SHELF_LABEL_PREFIX}${label}`;
  for (const line of runGit(projectPath, ['--no-pager', 'stash', 'list', format]).stdout.split('\n')) {
    const [ref = '', subject = ''] = line.split(FIELD_SEPARATOR);
    if (ref === '' || !/^stash@\{\d+\}$/.test(ref)) continue;
    const parsed = /^On (.+?): (.+)$/.exec(subject.trimEnd());
    if (parsed !== null && parsed[2] === wanted) return ref;
  }
  return null;
}
