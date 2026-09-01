// Map a STORED role to the role a chat message replays under.
//
// `summary` replays as an assistant note — it stands in the history where the turns it collapsed used
// to be, and any other role would break the chat template on replay.
//
// Named toMessageRole rather than the module-private `chatRole` it was extracted from, for two
// reasons: it returns Ollama's `Message['role']` rather than this folder's ChatRole, and the
// `chat-role` stem belongs to chat-role.type.ts — a `.type.ts` may not share a stem with a `.ts`.

import type { Message } from '../llm/index.js';

import type { MemoryRecord } from './memory-record.type.js';

/** Map a stored role to a chat role; `summary` replays as an assistant note. */
export function toMessageRole(role: MemoryRecord['role']): Message['role'] {
  return role === 'summary' ? 'assistant' : role;
}
