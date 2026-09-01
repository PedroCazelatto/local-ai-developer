// The definition of "still in the phase's live history", as a SQL predicate, built in ONE place.
//
// There are two ways a turn leaves a phase's live history without being deleted: a summary collapsed
// it, or the user cancelled the exchange it belonged to. Every read shares this builder so a third
// reason to hide a turn can never be added to one query and forgotten in another.

/** The VISIBLE predicate. `alias` qualifies the columns for queries that join (`m.` in LIST_SELECT). */
export function visibleTurnWhere(alias = ''): string {
  return `${alias}replaced_by IS NULL AND ${alias}cancelled_at IS NULL`;
}
