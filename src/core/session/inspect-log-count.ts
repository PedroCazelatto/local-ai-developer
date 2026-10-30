// The commit-count bounds on `git_inspect log`, in one place because both the default and the ceiling
// describe the same limit from two ends and the tool layer quotes them to the model.
//
// A log's cost is in its ROWS, not its characters, which is why it is capped by count as well as by
// the char budget every other inspection shares (review-diff-budget.ts). The model cannot raise
// either; `count` only ever narrows.

/** Commits `log` returns when the caller does not say. */
export const DEFAULT_LOG_COUNT = 20;

/** Hard ceiling on `log` rows, whatever the caller asks for. */
export const MAX_LOG_COUNT = 100;
