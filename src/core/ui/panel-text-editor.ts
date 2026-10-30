// The ask_user panel's free-text editor, shown after the user picks "Other".
//
// Shift+Enter puts real newlines in the draft, so it renders as one panel row PER typed line — the
// ` › ` marker on the first, the rest aligned under it. Each row is truncated independently, keeping
// the one-row-per-line invariant the panel is built on. The draft is append-only (no arrow keys), so
// the block cursor is always on the last row.

import { PANEL_INDENT } from './panel-indent.js';
import type { QuestionPanelState } from './render-question-panel.js';
import { theme } from './theme.js';
import { truncateToWidth } from './truncate-to-width.js';

/** The free-text draft as panel rows, with a block cursor at the end. */
export function panelTextEditor(state: QuestionPanelState, width: number): string[] {
  const typed = state.draft.split('\n');
  return typed.map((source, index) => {
    const marker = index === 0 ? theme.meta('›') : ' ';
    const caret = index === typed.length - 1 ? theme.md.bullet('▏') : '';
    return `${PANEL_INDENT}${marker} ${truncateToWidth(source, width - 4)}${caret}`;
  });
}
