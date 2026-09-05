// Narrow a parsed JSON value to Ollama's ToolCall[]. The database is hand-inspectable AND machine-fed,
// so the stored `tool_calls` blob is treated as untrusted on the way back in.

import type { ToolCall } from 'ollama';

/** Narrow a parsed JSON value to Ollama's ToolCall[] — the DB is hand-inspectable AND machine-fed. */
export function isToolCallArray(value: unknown): value is ToolCall[] {
  return (
    Array.isArray(value) &&
    value.every((entry) => {
      if (typeof entry !== 'object' || entry === null) return false;
      const fn = (entry as { function?: unknown }).function;
      if (typeof fn !== 'object' || fn === null) return false;
      return typeof (fn as { name?: unknown }).name === 'string';
    })
  );
}
