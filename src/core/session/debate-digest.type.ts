// The distilled report the calling phase actually reads -- written by a THIRD, neutral context, because
// a local model asked whether its own objections still stand finds that they all do.
//
// This is the only thing the debate costs the calling phase in context: the argument itself runs on
// throwaway windows and never enters any phase's memory.

/** The distilled report the calling phase actually reads — written by a third, neutral context. */
export interface DebateDigest {
  /** False when any objection was left unanswered or was conceded by the proponent. */
  readonly survived: boolean;
  /** The objections the defence never answered. Empty when none stand. */
  readonly standingObjections: readonly string[];
  /** The parts of the claim the defence established under attack. Empty when it established nothing. */
  readonly heldUp: readonly string[];
  /** One instruction: what to change before using the claim. Empty when nothing needs to change. */
  readonly revise: string;
}
