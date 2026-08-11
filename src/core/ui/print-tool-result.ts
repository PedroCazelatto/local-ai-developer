// Print the `←` line (and any diff under it) for a tool call that has just returned.
//
// Everything goes out in ONE interjectLine so a multi-row diff lifts and lays back the live row once
// rather than once per row — the activity line is still up at this point, because the call only ends
// after its result has been recorded.

import * as renderer from './renderer.js';
import { formatToolResultLines } from './format-tool-result-lines.js';
import type { ToolResultLinesInput } from './format-tool-result-lines.type.js';
import { terminalColumns } from './terminal-columns.js';

/** What printToolResult needs, minus the width it reads from the terminal itself. */
export type ToolResultView = Omit<ToolResultLinesInput, 'width'>;

/** Record one finished tool call in the scrollback: the result line, then its diff body if it has one. */
export function printToolResult(view: ToolResultView): void {
  const lines = formatToolResultLines({ ...view, width: terminalColumns() });
  renderer.interjectLine(lines.join('\n'));
}
