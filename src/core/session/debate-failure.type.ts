// Why a debate produced no digest. Both are surfaced to the model as a recoverable tool error -- never
// papered over with an invented verdict (constitution: surface an absent value, do not guess it).

/**
 * Why a debate produced no digest. Both are surfaced to the model as a recoverable tool error — never
 * papered over with an invented verdict (constitution: surface an absent value, do not guess it).
 *
 * - `no-argument`: the challenger's first reply was empty, so there was never an argument to distil.
 * - `unreadable-digest`: the distiller returned no valid JSON object, twice.
 */
export type DebateFailure = 'no-argument' | 'unreadable-digest';
