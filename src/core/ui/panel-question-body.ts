// The ask_user panel's body on a question tab: the question, then its options — or the free-text
// editor, once the user has picked "Other".
//
// Option numbers are LABELS, not keys. The keymap is arrows only, so the numbers exist to orient the
// eye and to let the user refer to "option 3"; no number-key handling is wired to them, which is why
// the budget below merely reserves their width.

import { PANEL_INDENT } from './panel-indent.js';
import { panelTextEditor } from './panel-text-editor.js';
import type { QuestionPanelState } from './render-question-panel.js';
import { theme } from './theme.js';
import { truncateToWidth } from './truncate-to-width.js';

/** Marker on the highlighted option. */
const CURSOR = '▸';

/** The active question and its options — or the free-text editor when the user picked "Other". */
export function panelQuestionBody(state: QuestionPanelState, width: number): string[] {
  const question = state.questions[state.tab];
  const options = state.options[state.tab];
  if (question === undefined || options === undefined) return []; // tab is always in range; never guess
  const prompt = `${PANEL_INDENT}${theme.strong(truncateToWidth(question.question, width - 1))}`;
  if (state.mode === 'text') {
    // panelTextEditor: the draft as one panel row per typed line, block cursor on the last.
    return [prompt, '', ...panelTextEditor(state, width)];
  }
  // Budget: indent + cursor + space + "N. " + text.
  const optionWidth = width - 1 - 2 - String(options.length).length - 2;
  const lines = options.map((option, index) => {
    const number = theme.md.bullet(`${index + 1}.`);
    const text = truncateToWidth(option, optionWidth);
    if (index === state.cursor) {
      return `${PANEL_INDENT}${theme.phase(state.phase)(CURSOR)} ${number} ${theme.md.bold(text)}`;
    }
    return `${PANEL_INDENT}  ${number} ${text}`;
  });
  return [prompt, '', ...lines];
}
