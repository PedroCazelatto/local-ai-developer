// Tool-call audit log (V1/06) — the only safety net for autonomous, no-confirmation tool calls
// (CLAUDE.md). Inserts ONE row per call into the `tool_audit` table of the project's memory.db, from the
// single choke point every finished call passes through (record-tool-call.ts) — tools never write their
// own rows. Ports core/session/audit.py, renaming the legacy `persona` field to `phase`.
//
// It was `tool_audit.jsonl` until backlog item 19; that file is left where it is and no longer written
// or read. Each row is its own autocommitted INSERT under `synchronous = FULL`, so a kill mid-tool loses
// at most the row being written — the guarantee fsync-per-line gave the file, now from a transaction.
// A failed write THROWS where it happens, exactly as a failed append did: a call that ran but left no
// record must never pass silently. Only a ~1 KB output PREVIEW is stored — the full result the model
// read is already the `tool` row of the conversation that made the call.
//
// A connection is opened per row and closed again, like the spawned-window trace: the writer is reached
// from every window with nothing but a project path, and a tool call is never fast enough for the
// opening to matter.

import type { ToolCallRecord } from './tool-call-record.type.js';
import { openMemoryDb } from './open-memory-db.js';

/** Only the first ~1 KB of a tool's result is kept on the row (never the full output). */
export const OUTPUT_PREVIEW_LIMIT = 1024;

/** Insert one audit row for a dispatched tool call into memory.db's `tool_audit` table. */
export function appendAuditRow(projectPath: string, record: ToolCallRecord): void {
  const output = record.output;
  // openMemoryDb: creates .orchestrator/memory.db on first use and applies the schema, both logs included.
  const db = openMemoryDb(projectPath);
  try {
    db.prepare(
      'INSERT INTO tool_audit (ts, phase, tool, args, exit_status, duration_ms, output_truncated, ' +
        'output_preview, error, metadata, subagent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(
      record.ts, // UTC ISO-8601 ms, when the call started
      record.phase, // NOT `persona` — the legacy Python name is not carried over
      record.tool,
      JSON.stringify(record.args),
      record.exitStatus, // 0 / real code / -1 for any failure
      record.durationMs,
      output.length > OUTPUT_PREVIEW_LIMIT ? 1 : 0,
      output.slice(0, OUTPUT_PREVIEW_LIMIT),
      record.error, // null on success
      record.metadata !== undefined ? JSON.stringify(record.metadata) : null,
      // A sub-agent's own tool call (V5/01) carries its id so lineage traces back to the sub-agent; a
      // master-phase call leaves it NULL.
      record.subagentId ?? null,
    );
  } finally {
    db.close();
  }
}
