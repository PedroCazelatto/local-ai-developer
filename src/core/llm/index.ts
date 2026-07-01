// core/llm/ — Ollama client: chat + stream + tool-calling, num_ctx option, and EXACT
// token counts read from prompt_eval_count / eval_count (never estimated).
export { OllamaClient } from './client.js';
export type { StreamHandle } from './client.js';
export { StreamFilter } from './stream-filter.js';
export { loadsOrRepair } from './json-repair.js';
export type { ChatResult, Message, TokenCounts, Tool, ToolCall } from './types.js';
