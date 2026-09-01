// One task the batch ESCALATED. A non-pass is no longer "uncommitted": the Reviewer accepts files
// partially, so an earlier round may have landed some of the work, and whatever is LEFT was stashed.

/**
 * A task that failed every round; its remaining attempt stashed for the user to inspect. NOT
 * necessarily uncommitted: the Reviewer commits partially, so earlier rounds may have accepted some
 * files — `commits` is what landed before the loop ran out of rounds.
 */
export interface BatchEscalated {
  readonly taskId: string;
  readonly rounds: number;
  readonly lastFeedback: string;
  /** Short SHAs the Reviewer accepted along the way, oldest first; empty when nothing landed. */
  readonly commits: readonly string[];
  /** Stable `git stash` label of the preserved attempt, or null if there was nothing to stash. */
  readonly stashRef: string | null;
}
