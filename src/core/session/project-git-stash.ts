// Model-facing stash — the "shelf". Backs the git_stash tool: save / list / pop / drop, addressed by
// a label the model chooses.
//
// THE HAZARD THIS FILE EXISTS TO AVOID: project-git.ts already stashes, under `lad-stash:<taskId>`,
// and that stash IS the durable record of a failed Worker attempt — Retro reads it and the user
// reviews it. If the model shared that namespace it could pop or drop the evidence of its own
// failure. So the shelf gets a DISJOINT prefix, and every read here filters to it: a task-loop stash
// is invisible to `list`, and unreachable by `pop`/`drop`, because no label the model can name will
// ever resolve to one (a label may not contain a colon, so `lad-shelf:` can never be made to spell
// `lad-stash:`).
//
// Addressing is by label, never by `stash@{n}`: an index shifts whenever anything else is stashed,
// and the task loop stashes on its own schedule, so an index the model read one turn ago can point at
// a different stash by the next.

import { runGit } from './run-git.js';
import type { Shelf, ShelfResult } from './project-git-stash.type.js';

/** The model's stash namespace. Disjoint from project-git.ts's `lad-stash:` — see the file header. */
export const SHELF_LABEL_PREFIX = 'lad-shelf:';

/** Longest label accepted — long enough to be descriptive, short enough to stay readable in a list. */
const MAX_LABEL_LENGTH = 60;

// Letters, digits, dot, dash, underscore. Deliberately NO colon (a colon would let a label forge a
// `lad-stash:` message and reach the task loop's stashes) and no whitespace (the stash message is
// parsed back out of one line of `git stash list`).
const LABEL_PATTERN = /^[A-Za-z0-9._-]+$/;

/** ASCII unit separator — splits the `git stash list` fields. Cannot occur in a label or branch name. */
const FIELD_SEPARATOR = '\x1f';

/** True when `label` is a legal shelf label. A false here is a model-facing error, not a crash. */
export function isValidShelfLabel(label: string): boolean {
  return label.length > 0 && label.length <= MAX_LABEL_LENGTH && LABEL_PATTERN.test(label);
}

/** Why `label` was rejected — the exact sentence the model is shown, so it can pick a legal one. */
export function shelfLabelError(label: string): string {
  if (label.length === 0) return "'label' must not be empty.";
  if (label.length > MAX_LABEL_LENGTH) return `'label' must be at most ${MAX_LABEL_LENGTH} characters.`;
  return `'${label}' is not a valid label — use only letters, digits, '.', '-' and '_' (no spaces, no ':').`;
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

/**
 * The `stash@{n}` ref carrying `label`, or null when the shelf does not exist. Resolved by MESSAGE,
 * so it stays correct after another stash is pushed — and it can only ever match a `lad-shelf:` entry,
 * which is what keeps a task-loop stash unreachable from here.
 */
function findShelfRef(projectPath: string, label: string): string | null {
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

/** Restore `label` into the working tree and remove the shelf. Unknown label ⇒ recoverable refusal. */
export function popShelf(projectPath: string, label: string): ShelfResult {
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

/** Discard `label` without restoring it. Unknown label ⇒ recoverable refusal. */
export function dropShelf(projectPath: string, label: string): ShelfResult {
  const ref = findShelfRef(projectPath, label);
  if (ref === null) return { ok: false, label, error: `no shelf named '${label}'.` };
  const drop = runGit(projectPath, ['stash', 'drop', ref]);
  if (!drop.ok) return { ok: false, label, error: `git stash drop failed: ${drop.stderr}` };
  return { ok: true, label };
}
