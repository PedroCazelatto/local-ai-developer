// Rebuild the stored `tool_calls` column into ToolCall[]. NEVER throws: a hand-edited or truncated
// value must not sink a reopen — the turn simply replays without its calls.

import type { SQLOutputValue } from 'node:sqlite';
import type { ToolCall } from 'ollama';

import { isToolCallArray } from './is-tool-call-array.js';

/** Rebuild the `tool_calls` column into ToolCall[]; undefined when absent or unparseable (never throws). */
export function parseToolCalls(value: SQLOutputValue | undefined): ToolCall[] | undefined {
  if (typeof value !== 'string' || value === '') return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    // isToolCallArray: every entry has a `function` object carrying a string `name`.
    return isToolCallArray(parsed) ? parsed : undefined;
  } catch {
    // A hand-edited or truncated value must not sink a reopen — the turn replays without its calls.
    return undefined;
  }
}
