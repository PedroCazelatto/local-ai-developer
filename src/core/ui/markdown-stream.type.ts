// Type for create-markdown-stream.ts (constitution: types live in a sibling file, never inline).

/** A single assistant turn's output sink: raw deltas in, formatted markdown on screen. */
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
