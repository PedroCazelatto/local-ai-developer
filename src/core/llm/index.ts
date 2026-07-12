// core/llm/ — Ollama client: chat + stream + tool-calling, num_ctx option, and EXACT
// token counts read from prompt_eval_count / eval_count (never estimated).
export { OllamaClient } from './client.js';
export type { StreamHandle } from './client.js';
// V4/02: a fresh, history-free Ollama call (same model + num_ctx, not in session memory) — used by
// search_rules and shared with summarization (V4/05).
export { oneShot } from './one-shot.js';
export type { OneShotResult } from './one-shot.type.js';
export { StreamFilter } from './stream-filter.js';
export { loadsOrRepair, repairDecode } from './json-repair.js';
export { recoverToolCalls } from './tool-call-recovery.js';
export type { Recovery } from './tool-call-recovery.js';
export type { ChatResult, Message, TokenCounts, Tool, ToolCall } from './types.js';
