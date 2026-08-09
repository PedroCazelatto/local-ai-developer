// Types for turn-aborted-error.ts (constitution: types live in a sibling file, never inline).

/**
 * Why a model call stopped early. The two are handled DIFFERENTLY and must never be collapsed into one
 * "the call failed": a `user` abort is a deliberate act that unwinds to the prompt with no error styling,
 * while a `timeout` is a fault worth reporting as one — an unreachable or wedged daemon, not a choice.
 */
export type TurnAbortReason = 'user' | 'timeout';
