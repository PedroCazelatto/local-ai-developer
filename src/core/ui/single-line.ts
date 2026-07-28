// Flatten a possibly multi-line string onto one row, for the places that summarize an answer rather
// than present it for editing: the panel's Review tab and the transcript it leaves in the scrollback.
//
// This is a HARD requirement for the Review tab, not a nicety. render-question-panel.ts guarantees one
// terminal row per line it returns — the widget redraws by moving the cursor up by its own line count —
// and a free-text answer composed with Shift+Enter now carries real newlines. One of those reaching the
// frame would push the panel a row out of step and smear it down the screen on every keypress.

/** `text` with every run of line breaks (and the whitespace around them) collapsed to one space. */
export function singleLine(text: string): string {
  return text.replace(/\s*\n\s*/g, ' ');
}
