// oneShot (V4/02) — a single, fresh, HISTORY-FREE call to the session model. The caller hands a
// standalone `messages` array; these turns are NEVER appended to any phase's SessionMemory (that lives
// in the orchestrator / spawned windows, not here). This is the mechanism behind CLAUDE.md's
// "LLM-delegated search": the standards catalog is assembled into this throwaway call and discarded, so
// the main context never holds it. Shared with summarization (V4/05) — both need "one Ollama call, off
// to the side, not in session memory".
//
// It delegates to OllamaClient.chat (same model + num_ctx, NO tools) purely to reuse the exact token
// capture (prompt_eval_count / eval_count) — never a length estimate (constitution). chat() is stateless
// w.r.t. session memory, so nothing is persisted; the returned tokens are this call's own, exact counts.

import type { OllamaClient } from './client.js';
import type { OneShotResult } from './one-shot.type.js';
import type { Message } from './types.js';

export async function oneShot(client: OllamaClient, messages: Message[]): Promise<OneShotResult> {
  // No tools: a one-shot is text-in / text-out. chat() returns the EXACT tokens for this single call.
  const { message, tokens } = await client.chat(messages);
  return { content: message.content, tokens };
}
