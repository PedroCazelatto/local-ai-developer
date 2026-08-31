// Print the `→` line for a tool call that is about to run.
//
// interjectLine, never a bare write: a tool call is dispatched with the transient activity line
// (`⠹ running edit_file (1.1s)`) sitting on the cursor row, and a sub-agent's calls run inside the
// master's own call, so that line is up for those too. Writing straight to the row welds the spinner
// frame into the append-only scrollback, which is a transient widget's frame stuck in history.
// interjectLine lifts whatever owns the row — a reply in flight or the activity line — and lays it
// back down afterwards.

import { renderer } from './renderer.js';
import { formatToolCallLine } from './format-tool-call-line.js';
import { terminalColumns } from './terminal-columns.js';

/**
 * Record one tool call in the scrollback, styled and fitted. `subagentShortId` marks and indents a
 * call a sub-agent made rather than the phase itself.
 */
export function printToolCall(
  tool: string,
  args: Record<string, unknown>,
  subagentShortId?: string,
): void {
  renderer.interjectLine(
    formatToolCallLine({
      tool,
      args,
      width: terminalColumns(),
      ...(subagentShortId !== undefined ? { subagentShortId } : {}),
    }),
  );
}
