// Type for create-markdown-stream.ts (constitution: types live in a sibling file, never inline).

/** A single assistant turn's output sink: raw deltas in, formatted markdown on screen. */
export interface MarkdownStream {
  /** Feed one streamed delta. Prints immediately; completed lines are repainted formatted. */
  push(delta: string): void;
  /** Finish the turn: render any trailing line the model left without a newline. */
  end(): void;
}
