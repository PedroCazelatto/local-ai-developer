// The user's answer to a raised blocker, persisted as a `resolved` row referencing the raised id. The
// `raised` row is never edited: the PAIR of rows is the state.

/** The user's answer to a blocker (persisted as a `resolved` row referencing the raised `id`). */
export interface ResolvedBlocker {
  /** The `id` of the `raised` row this answers. */
  readonly id: string;
  /** The user's answer text (from /answer). */
  readonly answer: string;
  /** UTC ISO-8601 ms, when the user answered. */
  readonly resolvedAt: string;
}
