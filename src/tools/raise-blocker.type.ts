// Types for the raise_blocker tool (V3/02), beside raise-blocker.ts (constitution: types in a
// sibling file). These are the STRUCTURED, recoverable results the model reads back — a rejection is
// not a thrown error; the Reviewer reads it and continues its turn.

/** Why a raise_blocker call was rejected (structured, recoverable). */
export type RaiseBlockerRejection =
  /** question was empty / whitespace — the Reviewer must supply a real question. */
  | 'empty_question'
  /**
   * The caller is not the Reviewer. Defense in depth: the tool is only ever wired into the Reviewer
   * window (never the global registry), so the Worker can't reach it at all — but if a call somehow
   * arrives from another phase, reject it here rather than honoring it.
   */
  | 'not_authorized';

/** The gate's decision: an accepted, non-empty question, or a structured rejection. */
export type BlockerRequest =
  | { readonly ok: true; readonly question: string }
  | { readonly ok: false; readonly error: RaiseBlockerRejection; readonly message: string };
