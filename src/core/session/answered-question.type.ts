// A pending question the user has since answered, waiting to be handed back to the phase that asked it.

/** A pending question the user has since answered, waiting to be handed to its phase. */
export interface AnsweredQuestion {
  readonly id: string;
  readonly phase: string;
  readonly question: string;
  /** The chosen option or free text the user gave via /questions. */
  readonly answer: string;
  /** UTC ISO-8601 ms, when the user answered. */
  readonly answeredAt: string;
}
