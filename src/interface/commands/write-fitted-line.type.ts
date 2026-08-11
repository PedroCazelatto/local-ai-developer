// Types for write-fitted-line.ts (constitution: types live in a sibling file, never inline).
//
// The inspection commands (/tasks, /blockers, /inbox, /batch, /audit) all print the same shape of
// output — a static, copyable block of one-terminal-row lines — so they share one row contract: the
// PLAIN text of the row, plus the theme styler that paints it. Plain text is the point: it is what
// can be measured and cut (truncate-to-width.ts refuses styled input, because a cut landing inside an
// escape sequence leaks a half-sequence), so a row is always truncated first and styled after.

/** A styler from theme.ts — text in, ANSI-wrapped text out. Every color in the UI lives in theme.ts alone. */
export type RowStyle = (text: string) => string;

/** One row of a rendered block: its PLAIN text (measurable, cuttable) and the theme styler to paint it. */
export interface FittedRow {
  /** The row's text with no ANSI escapes in it — styling is applied after the row is cut to width. */
  readonly text: string;
  /** The theme styler that paints the whole row once it fits. */
  readonly style: RowStyle;
}
