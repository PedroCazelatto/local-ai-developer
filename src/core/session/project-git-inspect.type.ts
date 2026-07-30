// Shape for read-only history inspection (project-git-inspect.ts).

export interface InspectResult {
  readonly ok: boolean;
  /** The bounded output. "" when there is nothing to show (a clean diff, an empty log). */
  readonly output: string;
  /** True when the output was cut to fit the budget — the model is told, never left guessing. */
  readonly truncated: boolean;
  /** Structured, recoverable reason when ok === false. */
  readonly error?: string;
}
