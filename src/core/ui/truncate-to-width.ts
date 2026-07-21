// Cut a PLAIN (unstyled) string to at most `width` columns, marking the cut with an ellipsis.
//
// Used by render-question-panel.ts, which must guarantee every line it emits occupies exactly one
// terminal row: the widget redraws itself by moving the cursor up by its own line count, so a single
// wrapped line would desynchronize the redraw and smear the panel down the screen.
//
// Plain text only, by design — measuring a styled string means counting around escape codes, and a
// cut could land inside one and leak a half-sequence. Truncate first, style after.

/** `text` cut to `width` columns (ellipsis included in the budget). Returns '' for a width under 1. */
export function truncateToWidth(text: string, width: number): string {
  if (width < 1) return '';
  if (text.length <= width) return text;
  if (width === 1) return '…';
  return `${text.slice(0, width - 1)}…`;
}
