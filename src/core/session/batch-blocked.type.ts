// One task the batch left BLOCKED, awaiting the user's /answer. Retro reads the stash later.

/** A task the Reviewer raised a blocker on — queued for /answer; its attempt stashed for Retro to read. */
export interface BatchBlocked {
  readonly taskId: string;
  readonly blockerId: string | null;
  readonly question: string;
  /** Short SHAs the Reviewer had already accepted before it halted; empty when nothing landed. */
  readonly commits: readonly string[];
  /** Stable `git stash` label of the attempt Retro will inspect, or null if there was nothing to stash. */
  readonly stashRef: string | null;
}
