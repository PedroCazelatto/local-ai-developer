// Part of the Reviewer window's contract with the orchestrator (V2/01).

/** One commit the Reviewer made during this review — recorded as it happens, for the UI and the Worker. */
export interface ReviewerCommit {
  /** Short SHA, or null when git reported none. */
  readonly sha: string | null;
  /** Project-relative paths in that commit. */
  readonly files: readonly string[];
}
