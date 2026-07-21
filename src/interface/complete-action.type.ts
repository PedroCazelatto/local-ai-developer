// The result of resolving a Tab press into a concrete action (complete-action.ts). The keypress
// handler applies it: insert `extend` into the line, then show `candidates` if there are several.

/** What a Tab should do at the current cursor. */
export interface CompleteAction {
  /** Text to insert at the cursor to extend toward the completion — '' when there is nothing to add. */
  readonly extend: string;
  /**
   * The candidate words worth SHOWING the user, i.e. only when the completion is still ambiguous
   * (two or more). Empty for zero or one candidate — a lone match is simply inserted, nothing to list.
   */
  readonly candidates: readonly string[];
}
