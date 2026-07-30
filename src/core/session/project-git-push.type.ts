// Shape for the model-facing push (project-git-push.ts).

export interface PushResult {
  readonly ok: boolean;
  /** The branch that was pushed — always the checked-out one; the model never names it. */
  readonly branch: string;
  /** True when this push CREATED the branch on the remote (allowed; creating the repo is not). */
  readonly createdRemoteBranch: boolean;
  /** True when the remote already had every commit — a no-op push, not a failure. */
  readonly upToDate: boolean;
  /** Structured, recoverable reason when ok === false. */
  readonly error?: string;
  /** What the model should do about `error` — for a missing repo, that means asking the user. */
  readonly hint?: string;
}
