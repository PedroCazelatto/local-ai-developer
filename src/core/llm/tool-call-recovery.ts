// Recover tool calls qwen2.5-coder emits as bare JSON (or inside <tool_call> tags) in the
// streamed content instead of the structured `tool_calls` field. Ollama doesn't lift those into
// `message.tool_calls` for this model, so without this shim the orchestrator never sees the call
// and the turn loop can't dispatch. Port of core/llm/tool_call_recovery.py — delete once Ollama
// parses them reliably.

import { repairDecode } from './json-repair.js';
import type { ToolCall } from './types.js';

// Lazy `\{[\s\S]*?\}` is safe here because the trailing </tool_call> anchor forces it to expand
// to the LAST closing brace (so nested-object arguments are captured whole).
const TAGGED = /<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/g;
// A markdown fence opener (``` + optional language) immediately before a recovered call, so we
// can swallow the fence together with the call when cleaning the content.
const FENCE_BEFORE = /```[A-Za-z0-9_+.-]*[ \t]*(?:\r?\n[ \t]*)?$/;
const WHITESPACE = ' \t\r\n';

type Span = readonly [start: number, end: number];

export interface Recovery {
  /** Content with recovered call spans removed (trimmed). Unchanged when nothing was recovered. */
  readonly cleaned: string;
  /** Recovered calls in Ollama's shape; empty if none were found. */
  readonly calls: ToolCall[];
}

/** Extract tool calls the model wrote as text. Returns the cleaned content + recovered calls. */
export function recoverToolCalls(content: string): Recovery {
  const calls: ToolCall[] = [];
  const spans: Span[] = [];

  // 1) <tool_call>{...}</tool_call> tagged blocks.
  for (const match of content.matchAll(TAGGED)) {
    const call = parseCall(match[1] ?? '');
    if (call !== null) {
      calls.push(call);
      const start = match.index ?? 0;
      spans.push(expandOverFence(content, start, start + match[0].length));
    }
  }
  if (calls.length > 0) {
    return { cleaned: stripSpans(content, spans).trim(), calls };
  }

  // 2) Bare top-level JSON objects (the common qwen2.5-coder emission — no tags).
  let i = 0;
  while (i < content.length) {
    if (content[i] !== '{') {
      i += 1;
      continue;
    }
    const decoded = repairDecode(content.slice(i));
    if (decoded === null) {
      i += 1;
      continue;
    }
    const call = coerceCall(decoded.value);
    if (call !== null) {
      calls.push(call);
      spans.push(expandOverFence(content, i, i + decoded.consumed));
    }
    i += decoded.consumed;
  }
  if (calls.length > 0) {
    return { cleaned: stripSpans(content, spans).trim(), calls };
  }
  return { cleaned: content, calls: [] };
}

function parseCall(payload: string): ToolCall | null {
  const trimmed = payload.trim();
  try {
    return coerceCall(JSON.parse(trimmed));
  } catch {
    const decoded = repairDecode(trimmed);
    return decoded === null ? null : coerceCall(decoded.value);
  }
}

/** Coerce a decoded object into a ToolCall, tolerating the name/args key variants qwen emits. */
function coerceCall(obj: unknown): ToolCall | null {
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

/** Widen a span to also cover a wrapping ```json … ``` fence, so stripping leaves no fence debris. */
function expandOverFence(content: string, start: number, end: number): Span {
  const opener = FENCE_BEFORE.exec(content.slice(0, start));
  if (opener === null || opener.index + opener[0].length !== start) {
    return [start, end];
  }
  let j = end;
  while (j < content.length && WHITESPACE.includes(content[j] ?? '')) {
    j += 1;
  }
  if (content.startsWith('```', j)) {
    return [opener.index, j + 3];
  }
  if (j >= content.length) {
    // fence never closed (stream ended) — eat the opener anyway
    return [opener.index, j];
  }
  return [start, end];
}

/** Remove sorted (start, end) substrings from `text`, tolerating overlap. */
function stripSpans(text: string, spans: Span[]): string {
  const parts: string[] = [];
  let cursor = 0;
  for (const [start, end] of spans) {
    parts.push(text.slice(cursor, Math.max(start, cursor)));
    cursor = Math.max(cursor, end);
  }
  parts.push(text.slice(cursor));
  return parts.join('');
}
