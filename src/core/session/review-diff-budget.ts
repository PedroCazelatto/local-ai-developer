// The char budget every host-side git read is bounded by, in one place because five separate readers
// share it — the Reviewer's own diff (capture-changed-files.ts), the commit-message writer's
// pathspec-scoped diff (diff-paths.ts), Retro's read of a failed attempt (read-task-stash-diff.ts),
// and all three of the model's inspection reads (inspect-diff.ts / inspect-log.ts / inspect-show.ts).
//
// It exists because the whole session is sized around one num_ctx on one RTX 3060: an unbounded diff
// would quietly eat the budget everything else bends to. Two copies of that number is how two copies
// drift.

/** Char budget for the diff fed to the Reviewer — bounded so a huge change can't blow past num_ctx. */
export const REVIEW_DIFF_BUDGET = 12_000;
