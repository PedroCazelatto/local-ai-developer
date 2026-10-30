// Recover tool calls qwen2.5-coder emits as bare JSON (or inside <tool_call> tags) in the
// streamed content instead of the structured `tool_calls` field. Ollama doesn't lift those into
// `message.tool_calls` for this model, so without this shim the orchestrator never sees the call
// and the turn loop can't dispatch. Port of core/llm/tool_call_recovery.py — delete once Ollama
// parses them reliably.

import type { ToolCall } from 'ollama';

import { coerceCall } from './coerce-call.js';
import { expandOverFence } from './expand-over-fence.js';
import type { Span } from './expand-over-fence.js';
import { parseCall } from './parse-call.js';
import { repairDecode } from './repair-decode.js';
import { stripSpans } from './strip-spans.js';

// Lazy `\{[\s\S]*?\}` is safe here because the trailing </tool_call> anchor forces it to expand
// to the LAST closing brace (so nested-object arguments are captured whole).
const TAGGED = /<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/g;

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
    // parseCall decodes one tagged payload — strict parse first, control-character repair as fallback.
    const call = parseCall(match[1] ?? '');
    if (call !== null) {
      calls.push(call);
      const start = match.index ?? 0;
      // expandOverFence widens the span over a wrapping ```json … ``` so no fence debris is left behind.
      spans.push(expandOverFence(content, start, start + match[0].length));
    }
  }
  if (calls.length > 0) {
    // stripSpans cuts the recovered ranges out of the content, tolerating spans that overlap.
    return { cleaned: stripSpans(content, spans).trim(), calls };
  }

  // 2) Bare top-level JSON objects (the common qwen2.5-coder emission — no tags).
  let i = 0;
  while (i < content.length) {
    if (content[i] !== '{') {
      i += 1;
      continue;
    }
    // repairDecode parses ONE object off the front and reports how much text it consumed — which is
    // what locates the end of an object that has no closing delimiter to search for.
    const decoded = repairDecode(content.slice(i));
    if (decoded === null) {
      i += 1;
      continue;
    }
    // coerceCall accepts the name/args key variants qwen emits and rejects everything else.
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
