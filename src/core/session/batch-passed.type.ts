// One task the batch PASSED. The Reviewer already committed all of it, so the shas are recorded here
// as fact rather than as something still to do.

/** A task that passed review — the Reviewer committed every file and marked it done. */
export interface BatchPassed {
  readonly taskId: string;
  /** Short SHAs the Reviewer landed, oldest first; empty if git reported none. */
  readonly commits: readonly string[];
  readonly rounds: number;
}
