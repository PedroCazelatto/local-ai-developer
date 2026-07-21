// Type for render-markdown-line.ts (constitution: types live in a sibling file, never inline).

/** One rendered markdown line plus the fence state the NEXT line must be rendered with. */
export interface RenderedMarkdownLine {
  /** The line, styled with ANSI — ready to write verbatim. */
  readonly text: string;
  /**
   * Whether the line AFTER this one falls inside a ``` fenced block. Markdown is line-based except
   * for fences, so this one bit is the entire carried state: the caller threads it back in on the
   * next call (create-markdown-stream.ts owns it for a turn).
   */
  readonly insideFence: boolean;
}
