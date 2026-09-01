// Raw materials for one audit row. Every finished tool call passes through this shape -- including the
// three runner-level refusals (worker / reviewer / retro) that never reach the dispatcher at all, which
// is why the scrollback's `display` rides here rather than being handed round separately.

import type { JsonObject } from '../../tools/types.js';
import type { ToolCallDisplay } from '../ui/types.js';

/** Raw materials for one audit row, handed to the audit sink (V1/06 formats + writes the JSONL). */
export interface ToolCallRecord {
  readonly ts: string; // UTC ISO-8601 ms, captured when the call started (new Date().toISOString())
  readonly phase: string; // active phase at dispatch time
  readonly tool: string; // tool name as dispatched
  readonly args: Record<string, unknown>; // normalized, parsed arguments
  readonly exitStatus: number; // 0 success, real code for shell/container tools, -1 for any failure
  readonly durationMs: number; // wall-clock around execute()
  readonly output: string; // full tool result (the sink truncates to a preview)
  readonly error: string | null; // null on success; the error message on failure
  readonly metadata?: JsonObject; // tool-specific fields (e.g. execute_command's workdir)
  readonly subagentId?: string; // set (by the SubagentManager sink) for a sub-agent's own call — V5/01 lineage
  /**
   * What the SCROLLBACK should say about this call — the `←` result line and any diff. NOT audit data:
   * appendAuditRow builds its JSONL row from an explicit field list and never reads this, so
   * tool_audit.jsonl's format is unaffected and a diff body stays out of the log. It rides on the
   * record because the record is the ONE thing every finished call passes through — including the
   * three runner-level refusal paths (worker/reviewer/retro) that never reach this dispatcher.
   */
  readonly display?: ToolCallDisplay;
}
