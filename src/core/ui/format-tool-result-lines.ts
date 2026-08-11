// The `←` line: what the tool call actually did, on one row, plus the diff when it changed a file.
//
//   ← 340 lines
//   ← exit 0 · 2s
//   ← 12 matches in 5 files
//   ← 'old_string' not found in 'src/x.ts'.        (red — a failure must LOOK like one)
//   ← +2 −1
//       - const limit = 10;
//       + const limit = 20;
//       + const floor = 1;
//
// Pure — state in, styled lines out, nothing drawn.
//
// A FAILED call is red and a successful one is dim, which is the whole point of the line: today a
// refused edit_file and a successful one are indistinguishable from the outside. "Failed" is either an
// error the dispatcher recorded OR a non-zero exit status, so a test run that comes back exit 1 reads
// as the failure it is even though nothing threw.
//
// Elapsed time is shown ONLY where the wait is the point — a 40 ms read_file does not need a timer,
// and a 30-second build does. Whole seconds only: a sub-second call reads `· 0s`, which is honest
// ("under a second") in a way that rounding it up to 1s would not be.

import { theme } from './theme.js';
import type { ToolResultLinesInput } from './format-tool-result-lines.type.js';
import { RIGHT_MARGIN, SUBAGENT_INDENT } from './format-tool-call-line.js';
import { stripControlChars } from './strip-control-chars.js';
import { singleLine } from './single-line.js';
import { truncateToWidth } from './truncate-to-width.js';
import { visibleWidth } from './visible-width.js';

/** The tools whose elapsed time is worth a column: the ones you actually wait on. */
const TIMED_TOOLS: ReadonlySet<string> = new Set([
  'execute_command',
  'run_in_project',
  'debate',
  'spawn_subagent',
  'ask_subagent',
]);

/** How far a diff's body sits under the `← ` marker it belongs to. */
const DIFF_INDENT = '    ';

/** What a call with no display of its own and no error has to say for itself. */
const NOTHING_TO_REPORT = 'ok';

/** `· 12s` for a tool worth timing, otherwise nothing. Whole seconds — never a fabricated precision. */
function elapsed(tool: string, durationMs: number): string {
  return TIMED_TOOLS.has(tool) ? ` · ${Math.round(Math.max(0, durationMs) / 1000)}s` : '';
}

/** The styled lines recording one finished tool call: the `←` row, then any diff body under it. */
export function formatToolResultLines(input: ToolResultLinesInput): string[] {
  const indent = input.subagentShortId === undefined ? '' : SUBAGENT_INDENT;
  const marker = input.subagentShortId === undefined ? '' : ` [sub:${input.subagentShortId}]`;
  const failed = input.error !== null || input.exitStatus !== 0;
  const style = failed ? theme.error : theme.meta;

  // The tool's own summary when it has one; its own error message when it does not (better than a
  // re-invented phrase — the tools' error strings are already written to be read); `ok` otherwise.
  const summary = input.display?.summary ?? (input.error !== null ? input.error : NOTHING_TO_REPORT);
  const head = `${indent}← `;
  const diff = input.display?.diff;
  // A COLLAPSED diff names its file, because the counts alone say nothing about which file they are.
  // An expanded one does not: the body is right there under the path already on the `→` line.
  const path = diff !== undefined && diff.lines.length === 0 ? ` ${diff.path}` : '';

  // The path is EXEMPT from the budget, not merely appended after it. Subtracting it would let a long
  // path spend the whole row and leave nothing for the counts — which are the reason the line exists.
  // It is appended untruncated and the row wraps if it must, exactly as on the `→` line.
  const budget = input.width - visibleWidth(head) - visibleWidth(marker) - RIGHT_MARGIN;
  const summaryText = truncateToWidth(stripControlChars(singleLine(summary)), budget);
  const lines = [style(`${head}${summaryText}${elapsed(input.tool, input.durationMs)}${path}${marker}`)];

  for (const row of diff?.lines ?? []) {
    const added = row.startsWith('+');
    // The body is file content the MODEL wrote: stripped of control characters before it is styled, so
    // a planted escape cannot repaint the theme it is being printed in.
    const width = input.width - DIFF_INDENT.length - indent.length - RIGHT_MARGIN;
    const body = truncateToWidth(stripControlChars(row), width);
    lines.push((added ? theme.diff.added : theme.diff.removed)(`${indent}${DIFF_INDENT}${body}`));
  }
  return lines;
}
