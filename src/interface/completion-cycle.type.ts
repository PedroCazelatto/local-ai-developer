// The Tab cycle's own vocabulary. No single function owns it — replace-word.ts builds one,
// cycle-completion.ts advances one, and the REPL holds one between keystrokes — so under the
// one-type-per-file rule it is a standalone type module rather than a passenger in any of them.

/**
 * A Tab cycle in flight: the candidate words, which one is sitting in the line right now, and where in
 * the line that word starts. The REPL holds one across consecutive Tab presses and drops it the moment
 * any other key arrives.
 *
 * The candidates are captured ONCE, when the cycle starts, and are never recomputed while it runs. That
 * is deliberate: they come off the backlog on disk, and a file changing under a `/run` mid-cycle would
 * otherwise renumber the list between two presses and cycle the user somewhere they were not heading.
 */
export interface CompletionCycle {
  /** Every candidate for this position, in the stable order complete-line.ts sorted them into. */
  readonly candidates: readonly string[];
  /** Which candidate is currently in the line — the next press takes `(index + 1) % candidates.length`. */
  readonly index: number;
  /** Offset in the line where the completed word begins; the word runs from here to the cursor. */
  readonly start: number;
}
