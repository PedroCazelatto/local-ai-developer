// Print one line into the scrollback that must arrive NOW, whatever owns the cursor row.
//
// A reply being streamed is lifted and laid back down around it (create-markdown-stream's interject);
// the transient activity line is hidden and shown again. Without this the line would land in the
// middle of a half-written sentence — the reason it exists is a message queued mid-turn.

import { stdout } from 'node:process';

import { activityLine } from './activity-line.js';
import { rendererState } from './renderer-state.js';

/** Print `text` into the scrollback now, around whatever transient thing owns the cursor row. */
export function interjectLine(text: string): void {
  if (rendererState.live !== null) {
    rendererState.live.interject(text);
    return;
  }
  const wasVisible = activityLine.isVisible();
  if (wasVisible) activityLine.hide();
  stdout.write(`${text}\n`);
  if (wasVisible) activityLine.show();
}
