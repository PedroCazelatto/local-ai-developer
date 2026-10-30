// One finding on a Reviewer verdict. Every file the Reviewer declines to commit needs one of these
// naming it, so the Worker is never handed a file back without being told what is wrong with it.

import type { Severity } from './severity.type.js';

export interface ReviewIssue {
  /** blocker/major ⇒ the verdict must be "fail"; minor may ride along on a pass. */
  readonly severity: Severity;
  /** Project-relative path, e.g. "src/foo.ts"; "" when the issue isn't file-specific. */
  readonly file: string;
  /** Concrete + actionable: what is wrong and the fix direction (never a vague "looks off"). */
  readonly note: string;
}
