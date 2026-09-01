// A question the user left unanswered, persisted as an `asked` row and re-asked by /questions. A
// question answered on the spot needs no life beyond the turn; a question SKIPPED is a debt the model
// is owed, and must outlive the turn, the phase swap and a restart.

/** A question the user left unanswered, persisted as an `asked` row and re-asked by /questions. */
export interface PendingQuestion {
  /**
   * `${phase}#${n}` — n is a 1-based counter of questions ever saved for THIS phase. Human-readable
   * and stable, matching the blocker store's id scheme (chosen over a ULID there, so kept here too).
   */
  readonly id: string;
  /** The phase whose window asked it — it is the one that gets the answer back. */
  readonly phase: string;
  readonly question: string;
  /** The options the model offered, replayed verbatim when /questions re-asks it. */
  readonly options: readonly string[];
  /** UTC ISO-8601 ms, when the question was saved. */
  readonly askedAt: string;
}
