// The ask_user panel's keymap line, restated on every frame — the widget is transient, so nothing else
// can teach it. What it teaches depends on where the cursor is: on the free-text option, typing writes
// straight into the editor, so it says that instead of "enter confirm".

import { PANEL_INDENT } from './panel-indent.js';
import type { QuestionPanelState } from './render-question-panel.js';
import { theme } from './theme.js';
import { truncateToWidth } from './truncate-to-width.js';

/** The keymap for the panel's current state, on one row. */
export function panelHint(state: QuestionPanelState, isReview: boolean, width: number): string {
  const options = state.options[state.tab];
  const onFreeText =
    !isReview && state.mode === 'select' && options !== undefined && state.cursor === options.length - 1;
  const keys = state.mode === 'text'
    ? 'enter save · shift+enter newline · esc back to the options'
    : isReview
      ? 'enter submit · ←→ tab · esc close (unanswered are saved)'
      : onFreeText
        ? 'type to answer · ↑↓ choose · ←→ tab · esc close'
        : '↑↓ choose · enter confirm & next · ←→ tab · esc close';
  return `${PANEL_INDENT}${theme.meta(truncateToWidth(keys, width - 1))}`;
}
