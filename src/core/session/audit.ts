// Tool-call audit log (V1/06) — the only safety net for autonomous, no-confirmation tool calls
// (CLAUDE.md). Appends ONE JSON line per call to projects/<active>/.orchestrator/tool_audit.jsonl
// from the single dispatch choke point (V1/02) — tools never write their own rows. Ports
// core/session/audit.py, renaming the legacy `persona` field to `phase`.
//
// Append-only + flushed (fsync) per row: a kill mid-tool leaves a partial LAST line at worst, never
// a torn earlier row. Only a ~1 KB output PREVIEW is stored — full stdout/build logs stay out of
// the log (full-output persistence is deferred). The fsync-per-line durability lives in the shared
// appendJsonlLine writer, which the sibling events log (V5/04) uses too.

import path from 'node:path';

import { appendJsonlLine } from './append-jsonl-line.js';
import type { ToolCallRecord } from './tool-call-record.type.js';

/** Only the first ~1 KB of a tool's result is kept on the row (never the full output). */
export const OUTPUT_PREVIEW_LIMIT = 1024;

/**
 * Append one audit row for a dispatched tool call. Builds the row shape, then hands it to the shared
 * appendJsonlLine writer, which creates `<projectPath>/.orchestrator/` on first write and fsyncs the
 * line so prior rows are always intact on disk.
 */
export function appendAuditRow(projectPath: string, record: ToolCallRecord): void {
  const file = path.join(projectPath, '.orchestrator', 'tool_audit.jsonl');

  const output = record.output;
  const row: Record<string, unknown> = {
    ts: record.ts, // UTC ISO-8601 ms
    phase: record.phase, // NOT `persona` — the legacy Python name is not carried over
    tool: record.tool,
    args: record.args,
    exit_status: record.exitStatus, // 0 / real code / -1 for any failure
    duration_ms: record.durationMs,
    output_truncated: output.length > OUTPUT_PREVIEW_LIMIT,
    output_preview: output.slice(0, OUTPUT_PREVIEW_LIMIT),
    error: record.error, // null on success
  };
  if (record.metadata !== undefined) {
    row['metadata'] = record.metadata;
  }
  // A sub-agent's own tool call (V5/01) carries its id so lineage traces back to the sub-agent; a
  // master-phase call omits the field entirely (never a null placeholder).
  if (record.subagentId !== undefined) {
    row['subagent_id'] = record.subagentId;
  }

  appendJsonlLine(file, row);
}
