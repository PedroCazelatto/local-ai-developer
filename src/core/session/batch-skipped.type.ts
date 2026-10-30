// One task the batch skipped before running it -- already done, blocked, or waiting on a dependency.

/** A task skipped before running (already done, blocked awaiting an answer, or unmet dependencies). */
export interface BatchSkipped {
  readonly taskId: string;
  readonly reason: string;
}
