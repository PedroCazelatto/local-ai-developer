// The payload of one <tool_call> tag, decoded. A tagged block is already delimited, so the strict
// parse is tried first and the repair pass is the fallback — the opposite emphasis to the bare-JSON
// path, which has no delimiter and must repair-decode to find where the object ends at all.

import type { ToolCall } from 'ollama';

import { coerceCall } from './coerce-call.js';
import { repairDecode } from './repair-decode.js';

/** Decode one tagged tool-call payload into a ToolCall, or null when it is not one. */
export function parseCall(payload: string): ToolCall | null {
  const trimmed = payload.trim();
  try {
    // coerceCall accepts the name/args key variants qwen emits and rejects anything else.
    return coerceCall(JSON.parse(trimmed));
  } catch {
    // repairDecode re-parses with the literal control characters inside strings escaped.
    const decoded = repairDecode(trimmed);
    return decoded === null ? null : coerceCall(decoded.value);
  }
}
