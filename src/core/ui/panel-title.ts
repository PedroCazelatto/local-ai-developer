// The ask_user panel's first line: who is waiting on you, and how far along you are.

import { PANEL_INDENT } from './panel-indent.js';
import type { QuestionPanelState } from './render-question-panel.js';
import { theme } from './theme.js';
import { truncateToWidth } from './truncate-to-width.js';

/** `discovery asks · 2 of 3 answered` — who is waiting on you, and how far along you are. */
export function panelTitle(state: QuestionPanelState, width: number): string {
  const answered = state.answers.filter((answer) => answer !== null).length;
  const text = `${state.phase} asks · ${answered} of ${state.questions.length} answered`;
  return `${PANEL_INDENT}${theme.phase(state.phase)(truncateToWidth(text, width - 1))}`;
}
