// Shapes for model-facing branch operations (project-git-branch.ts).

/** The branch list, with the checked-out one called out so the model never has to infer it. */
export interface BranchList {
  readonly branches: string[];
  /** The checked-out branch, or null when HEAD is detached. */
  readonly current: string | null;
}

/** The outcome of a create / switch. `error` is set exactly when `ok` is false. */
export interface BranchResult {
  readonly ok: boolean;
  /** The branch now checked out (on success), or the one that was asked for (on failure). */
  readonly branch: string;
  /**
   * True when `create` found the branch already there and switched to it instead. The caller reports
   * this back so a re-run reads as "resumed", never as "created twice".
   */
  readonly existed: boolean;
  /** Structured, recoverable reason when ok === false. */
  readonly error?: string;
}
