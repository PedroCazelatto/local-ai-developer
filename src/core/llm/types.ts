// Shared LLM types. Re-export the ollama package's structural types rather than redefining
// them, so the whole codebase speaks one vocabulary for messages / tools / tool-calls.

import type { Message } from 'ollama';

export type { Message, Tool, ToolCall } from 'ollama';

/**
 * EXACT token counts from Ollama — never estimated. `null` means Ollama did not report the
 * metric on this call; the distinction between "0 tokens" and "not reported" is preserved
 * (never coerce null → 0). The whole VRAM-safety model depends on these being exact.
 */
export interface TokenCounts {
  readonly promptTokens: number | null; // exact prompt_eval_count; null if omitted
  readonly evalTokens: number | null; // exact eval_count; null if omitted
}

export interface ChatResult {
  readonly message: Message; // final assistant message, incl. content AND tool_calls
  readonly tokens: TokenCounts;
}
