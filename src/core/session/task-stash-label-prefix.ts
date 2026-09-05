// The TASK LOOP'S stash namespace, and nothing else may touch it.
//
// A task-keyed `git stash` message is the durable record of a failed Worker attempt — the stash
// message IS the record, there is no separate store — so Retro can inspect what went wrong and the
// user can review it. The model's own stash tool uses a DISJOINT `lad-shelf:` prefix (shelf-label.ts)
// precisely so a model can never pop or drop the evidence of its own failure. The two namespaces must
// never be merged.
//
// Named TASK_STASH_LABEL_PREFIX rather than the module-private STASH_LABEL_PREFIX it was extracted
// from: side by side with SHELF_LABEL_PREFIX in a flat folder, "stash" versus "shelf" is one letter of
// difference carrying the whole safety property.

/** Prefix of the task loop's own stash labels. One stash per task at a time. */
export const TASK_STASH_LABEL_PREFIX = 'lad-stash:';
