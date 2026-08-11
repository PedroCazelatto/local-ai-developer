// The one place a finished tool call is recorded: the durable audit row, and the `←` line in the
// scrollback. Both, always, from a single call — so the two records of what the model did cannot drift
// apart, and adding a tool cannot accidentally produce one without the other.
//
// This replaces every direct appendAuditRow call, and that choice is the point of the file.
// dispatch.ts's `onToolCall` seam looks like the natural hook and is the WRONG one: it is wired at
// five sites, but EIGHT places write an audit row. The other three are the runner-level refusals —
// the Worker refusing commit_changes/git_stash/git_push, the Reviewer refusing every write tool (and
// answering submit_verdict / raise_blocker / mark_task_done itself), and Retro refusing a second file
// (and answering the rules-scoped pair). Those never reach the dispatcher at all. They are also
// exactly the case this record was built for: a refused edit_file and a successful one used to look
// identical from the outside. Hooking `onToolCall` would have missed every one of them.
//
// The audit row is written FIRST. It is the constitution's safety net for autonomous, unconfirmed tool
// calls; the scrollback line is a convenience for whoever is watching. If only one of the two can
// happen, it is the durable one.

import { appendAuditRow } from './audit.js';
import type { ToolCallRecord } from './dispatch.js';
import { printToolResult } from '../ui/print-tool-result.js';

/**
 * Record one dispatched tool call: append its audit row, then print its `←` result line (and diff).
 * `subagentShortId` marks and indents a call a sub-agent made rather than the phase itself.
 */
export function recordToolCall(projectPath: string, record: ToolCallRecord, subagentShortId?: string): void {
  appendAuditRow(projectPath, record);
  // printToolResult: the styled `← <summary>` row plus any diff body, fitted to the terminal and
  // printed THROUGH the transient activity line that is still up while the call finishes.
  printToolResult({
    tool: record.tool,
    exitStatus: record.exitStatus,
    error: record.error,
    durationMs: record.durationMs,
    ...(record.display !== undefined ? { display: record.display } : {}),
    ...(subagentShortId !== undefined ? { subagentShortId } : {}),
  });
}
