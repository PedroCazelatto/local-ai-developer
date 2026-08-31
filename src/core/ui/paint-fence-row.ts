// Repaint the type-ahead row after an edit — one reserved row, so it costs no scrolling.
//
// Formatting the row is input-fence-row.ts's job; this is the half that puts the result on screen.

import { inputFenceRow } from './input-fence-row.js';
import { messageQueue } from './message-queue.js';
import { statusBar } from './status-bar.js';
import { terminalColumns } from './terminal-columns.js';

/** Repaint the type-ahead row after an edit — one reserved row, so it costs no scrolling. */
export function paintFenceRow(text: string): void {
  // inputFenceRow: the `› ` marker, the typed text tail-fitted to the width, and a drawn caret.
  statusBar.setInputFence(inputFenceRow(text, terminalColumns(), messageQueue.size()));
}
