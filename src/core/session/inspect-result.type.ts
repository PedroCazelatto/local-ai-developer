// The outcome of a read-only git inspection -- diff, log or show. All three build one through the same
// bounding helper, and every one of them is bounded: an unbounded answer would eat the num_ctx budget
// the whole session is sized around.

/** The outcome of a read-only diff / log / show. Every one of them is bounded. */
export interface InspectResult {
  readonly ok: boolean;
  /** The bounded output. "" when there is nothing to show (a clean diff, an empty log). */
  readonly output: string;
  /** True when the output was cut to fit the budget — the model is told, never left guessing. */
  readonly truncated: boolean;
  /** Structured, recoverable reason when ok === false. */
  readonly error?: string;
}
