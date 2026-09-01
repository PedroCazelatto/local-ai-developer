// The outcome of a model-facing branch create or switch. Owned by neither: create-branch.ts and
// switch-branch.ts both build one, and create delegates to switch when the branch already exists.

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
