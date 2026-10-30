// What the calling phase hands over to a debate: the position under test, plus the material to test
// it against. The asymmetry between the two debaters is built from this -- the proponent is seeded with
// `reasoning`, the challenger never is.

/** What the calling phase hands over: the position under test, plus the material to test it against. */
export interface DebateRequest {
  /** The one-or-two-sentence position being tested. */
  readonly claim: string;
  /** Why the caller believes it. Seeds the PROPONENT only — the challenger must find faults itself. */
  readonly reasoning: string;
  /** The files/constraints/facts the claim concerns, inline. Absent when the claim needs no material. */
  readonly background?: string;
}
