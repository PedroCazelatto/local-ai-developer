// One assistant turn's output sink, owned by no single function. TWO functions here return one --
// createMarkdownStream builds the closure-based handle, and assistantStream returns that same handle at
// the left margin -- and two more hold one without building it: renderer-state.ts keeps the live stream
// for the renderer family, and core/session/run-turn.ts holds one for the length of a turn. A handle
// with two producers and two holders is this folder's vocabulary, not one function's return type.
//
// It is an interface rather than the closure's inferred shape because the holders depend on it: the
// renderer's `live` slot and a turn's local are both typed `MarkdownStream | null`, and neither may
// know how the stream it was handed was made.

/**
 * A single assistant turn's output sink: raw deltas in, formatted markdown on screen.
 */
export interface MarkdownStream {
  /** Feed one streamed delta. Prints immediately; completed lines are repainted formatted. */
  push(delta: string): void;
  /** Finish the turn: render any trailing line the model left without a newline. */
  end(): void;
  /**
   * Print `block` ABOVE the line currently streaming, then put that line back under the cursor. For
   * anything that must reach the scrollback mid-turn (a queued message) without shredding the
   * half-written line it would otherwise land in the middle of.
   */
  interject(block: string): void;
}
