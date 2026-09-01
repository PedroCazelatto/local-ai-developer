// Rebuild one `messages` row into the in-RAM MemoryRecord shape. The optional fields are spread in
// CONDITIONALLY rather than set to null, so a record that never had a model has no `model` key at all
// — which is what keeps the in-RAM shape identical whether a turn came from a flush or from a reopen.

import type { SQLOutputValue } from 'node:sqlite';

import type { MemoryRecord } from './memory-record.type.js';
import { parseToolCalls } from './parse-tool-calls.js';
import { sqlInt } from './sql-int.js';
import { sqlIntOrNull } from './sql-int-or-null.js';
import { sqlMemoryRole } from './sql-memory-role.js';
import { sqlText } from './sql-text.js';
import { sqlTextOrNull } from './sql-text-or-null.js';

/** Rebuild one `messages` row into the in-RAM MemoryRecord shape. */
export function toMemoryRecord(row: Record<string, SQLOutputValue>): MemoryRecord {
  const model = sqlTextOrNull(row['model']);
  const toolName = sqlTextOrNull(row['tool_name']);
  // parseToolCalls: the JSON blob back into ToolCall[], or undefined if absent/unparseable.
  const toolCalls = parseToolCalls(row['tool_calls']);
  return {
    seq: sqlInt(row['seq']),
    ts: sqlText(row['created_at']),
    role: sqlMemoryRole(row['role']),
    content: sqlText(row['content']),
    // sqlIntOrNull, not sqlInt: a null token metric must never become a zero (constitution).
    tokens: { prompt: sqlIntOrNull(row['prompt_tokens']), completion: sqlIntOrNull(row['completion_tokens']) },
    ...(model !== null ? { model } : {}),
    ...(toolName !== null ? { tool_name: toolName } : {}),
    ...(toolCalls !== undefined ? { tool_calls: toolCalls } : {}),
  };
}
