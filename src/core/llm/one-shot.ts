// oneShot (V4/02) — a single, fresh, HISTORY-FREE call to the session model. The caller hands a
// standalone `messages` array; these turns are NEVER appended to any phase's SessionMemory (that lives
// in the orchestrator / spawned windows, not here). This is the mechanism behind CLAUDE.md's
// "LLM-delegated search": the standards catalog is assembled into this throwaway call and discarded, so
// the main context never holds it. Shared with summarization (V4/05) — both need "one Ollama call, off
// to the side, not in session memory".
//
// It delegates to OllamaClient.chat (same model, NO tools) purely to reuse the exact token capture
// (prompt_eval_count / eval_count) — never a length estimate (constitution). chat() is stateless w.r.t.
// session memory, so nothing is persisted; the returned tokens are this call's own, exact counts.
//
// The `num_ctx` is NOT necessarily the session's: `role` decides it (resolve-window-ctx.ts). Three of
// the six one-shot roles are bounded and run under a smaller ceiling; the other three take the base,
// because their input is either window-sized (`summarize`) or uncapped (`debate-*`). Passing the role
// rather than binding a ceiling here is what keeps that decision in one place instead of six.

import type { Message } from 'ollama';

import type { OllamaClient } from './client.js';
import type { OneShotRole } from './one-shot-role.type.js';
import type { TokenCounts } from './token-counts.type.js';

/**
 * The model's text reply plus the EXACT token counts Ollama reported for this single throwaway call.
 * Nulls in `tokens` mean Ollama omitted the metric (see TokenCounts) — never a length-based guess.
 */
export interface OneShotResult {
  /** The model's full text reply. A one-shot requests no tools, so there are no tool calls to handle. */
  readonly content: string;
  /** EXACT prompt/eval counts for THIS call — for auditing its cost, kept off the session status line. */
  readonly tokens: TokenCounts;
}

export async function oneShot(
  client: OllamaClient,
  messages: Message[],
  role: OneShotRole,
): Promise<OneShotResult> {
  // No tools: a one-shot is text-in / text-out. chat() returns the EXACT tokens for this single call,
  // under the ceiling `role` resolves to.
  const { message, tokens } = await client.chat(role, messages);
  return { content: message.content, tokens };
}
