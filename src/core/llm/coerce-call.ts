// The tolerance layer over what qwen2.5-coder actually emits when it writes a tool call as text: the
// name arrives under three different keys, the arguments under two, and the arguments are sometimes a
// JSON string rather than an object. Everything that does not resolve to { name, arguments } is
// rejected here, so nothing downstream has to re-check the shape.

import type { ToolCall } from 'ollama';

/** Coerce a decoded object into a ToolCall, tolerating the name/args key variants qwen emits. */
export function coerceCall(obj: unknown): ToolCall | null {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return null;
  }
  const record = obj as Record<string, unknown>;
  const name = record['name'] ?? record['function_name'] ?? record['tool'];
  let args = record['arguments'] ?? record['parameters'] ?? {};
  if (typeof args === 'string') {
    const trimmed = args.trim();
    if (trimmed === '') {
      args = {};
    } else {
      try {
        args = JSON.parse(trimmed);
      } catch {
        return null;
      }
    }
  }
  if (typeof name !== 'string' || typeof args !== 'object' || args === null || Array.isArray(args)) {
    return null;
  }
  return { function: { name, arguments: args as Record<string, unknown> } };
}
