// The shelf label vocabulary — the model's own stash namespace and the rules a label must obey.
//
// THE HAZARD THIS EXISTS TO AVOID: the task loop also stashes, under `lad-stash:<taskId>`
// (task-stash-label-prefix.ts), and that stash IS the durable record of a failed Worker attempt —
// Retro reads it and the user reviews it. If the model shared that namespace it could pop or drop the
// evidence of its own failure. So the shelf gets a DISJOINT prefix, and every shelf read filters to
// it: a task-loop stash is invisible to `list` and unreachable by `pop`/`drop`, because no label the
// model can name will ever resolve to one — a label may not contain a colon, so `lad-shelf:` can never
// be made to spell `lad-stash:`. The pattern below is what enforces that, which is why it lives beside
// the prefix rather than apart from it.

/** The model's stash namespace. Disjoint from the task loop's `lad-stash:` — see the file header. */
export const SHELF_LABEL_PREFIX = 'lad-shelf:';

/** Longest label accepted — long enough to be descriptive, short enough to stay readable in a list. */
export const MAX_LABEL_LENGTH = 60;

// Letters, digits, dot, dash, underscore. Deliberately NO colon (a colon would let a label forge a
// `lad-stash:` message and reach the task loop's stashes) and no whitespace (the stash message is
// parsed back out of one line of `git stash list`).
export const LABEL_PATTERN = /^[A-Za-z0-9._-]+$/;
