// The Reviewer ended without a usable verdict -- it never submitted one, or it submitted one that
// contradicted the repo too many times. A distinct class so the task loop can tell a Reviewer that
// failed to judge from a Reviewer that judged and failed the task.

/** The Reviewer ended without a usable verdict (never submitted, or malformed past the re-prompt). */
export class ReviewerVerdictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReviewerVerdictError';
  }
}
