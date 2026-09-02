// Rebuild one stored record into the Ollama Message shape — the REPLAY path.
//
// Not to be confused with render-turn.ts, which flattens a turn into prose for a throwaway context that
// must READ a transcript. This one produces structured fields for the model to continue from.
//
// Field handling mirrors SessionMemory.add: an absent tool name or an empty tool-call array leaves the
// key off entirely rather than setting it to null, so a replayed message is shaped exactly like the one
// that was buffered.

import type { Message } from 'ollama';

import type { MemoryRecord } from './memory-record.type.js';
import { toMessageRole } from './to-message-role.js';

/** Rebuild one record into the Ollama Message shape (mirrors SessionMemory.add's field handling). */
export function toMessage(record: MemoryRecord): Message {
  // toMessageRole: `summary` replays as `assistant`; every other role passes through.
  const message: Message = { role: toMessageRole(record.role), content: record.content };
  if (record.tool_name !== undefined) message.tool_name = record.tool_name;
  if (record.tool_calls !== undefined && record.tool_calls.length > 0) message.tool_calls = record.tool_calls;
  return message;
}
