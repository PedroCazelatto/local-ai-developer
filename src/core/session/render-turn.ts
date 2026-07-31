// renderTurn — one stored turn as a labelled block of plain text, for a throwaway context that must
// READ a transcript rather than replay it.
//
// Extracted so the summarization failsafe and the context-title writer render a transcript the same
// way: both hand a slice of one phase's history to a fresh one-shot, and a turn that reads differently
// in the two would make one of them reason about a shape the other never sees.
//
// This is NOT the replay path. Replay rebuilds Ollama `Message` objects (memory.ts, toMessage); this
// flattens a turn into prose a model is asked to summarize or describe, so the role and the tool call
// are spelled out in the text instead of living in structured fields.

import type { MemoryRecord } from './memory-db.type.js';

/** One turn as `[role]` (or `[tool:<name>]`), its content, and any tool calls the turn issued. */
export function renderTurn(record: MemoryRecord): string {
  const label = record.role === 'tool' && record.tool_name !== undefined ? `tool:${record.tool_name}` : record.role;
  const parts = [`[${label}]`];
  if (record.content.trim() !== '') parts.push(record.content.trim());
  if (record.tool_calls !== undefined && record.tool_calls.length > 0) {
    const calls = record.tool_calls
      .map((call) => `${call.function.name}(${JSON.stringify(call.function.arguments)})`)
      .join(', ');
    parts.push(`(tool calls: ${calls})`);
  }
  return parts.join('\n');
}
