// One task the batch never reached because the user asked it to stop.

/**
 * A task the user interrupted — Ctrl+C cut the model call, or a `/stop round` ended the loop between
 * rounds. Its own bucket rather than an escalation, because nothing judged it: the distinction is what
 * stops a wound-down overnight run from reading, the next morning, as five tasks that failed review.
 * Like every other non-pass it stashes what was left and may still carry commits an earlier round landed.
 */
export interface BatchCancelled {
  readonly taskId: string;
  readonly rounds: number;
  /** One line on how it was stopped, from the loop that stopped. */
  readonly reason: string;
  /** Short SHAs the Reviewer accepted before the interruption; empty when nothing landed. */
  readonly commits: readonly string[];
  /** Stable `git stash` label of the preserved attempt, or null if there was nothing to stash. */
  readonly stashRef: string | null;
}
