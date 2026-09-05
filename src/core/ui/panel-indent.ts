// The ask_user panel's left margin, in one place because every row of the frame starts with it and a
// row that disagreed would read as misaligned rather than as indented.
//
// It is also part of the panel's HARD INVARIANT (render-question-panel.ts): every line is truncated to
// a budget measured from the terminal width minus this margin, so the margin and the budget have to be
// derived from the same constant or a frame can wrap and smear down the screen.

/** Left margin of every line inside the panel. */
export const PANEL_INDENT = ' ';
