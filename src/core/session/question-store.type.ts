// Types for the question store, beside question-store.ts (constitution: types live in a sibling
// file, never inline). A question is DURABLE the moment the user declines to answer it: the whole
// point is that it survives the turn, the phase swap, and a restart, so nothing the model asked is
// silently lost. Open/answered/delivered state is reconstructed by REPLAY, never mutated in place —
// the same discipline as blocker-store.ts and the audit log.

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

/**
 * One append-only row in questions.jsonl, discriminated by `kind`. State = replay of these rows:
 * `asked` with no `answered` is pending; `answered` with no `delivered` is waiting to reach its
 * phase's context. `delivered` is what stops an answer being injected into the same window twice.
 */
export type QuestionRow =
  | ({ readonly kind: 'asked' } & PendingQuestion)
  | { readonly kind: 'answered'; readonly id: string; readonly answer: string; readonly answeredAt: string }
  | { readonly kind: 'delivered'; readonly id: string; readonly deliveredAt: string };
