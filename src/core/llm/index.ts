// core/llm/ — Ollama client: chat + stream + tool-calling, num_ctx option, and EXACT
// token counts read from prompt_eval_count / eval_count (never estimated).
export { OllamaClient } from './client.js';
export type { StreamHandle } from './client.js';
// V4/02: a fresh, history-free Ollama call (same model + num_ctx, not in session memory) — used by
// search_rules and shared with summarization (V4/05).
export { oneShot } from './one-shot.js';
export type { OneShotResult } from './one-shot.type.js';
// V5/02: daemon model-management wrappers (list / pull / hasModel) for the `/models` command.
export { listModels, hasModel, pullModel } from './ollama-models.js';
// The boot pick rule + the shared name/tag match, used by resolve-boot-model and `/models`.
export { pickSmallestModel } from './pick-smallest-model.js';
export { matchesModelName } from './matches-model-name.js';
export type { InstalledModel, PullProgress, PullProgressHandler, PullOutcome } from './ollama-models.type.js';
// Cancellation: every aborted model call — Ctrl+C or a stalled daemon — surfaces as this one error, on
// both the streamed and the non-streamed path, so one instanceof check covers every window.
export { TurnAbortedError } from './turn-aborted-error.js';
export type { TurnAbortReason } from './turn-aborted-error.type.js';
export { StreamFilter } from './stream-filter.js';
export { loadsOrRepair, repairDecode } from './json-repair.js';
export { recoverToolCalls } from './tool-call-recovery.js';
export type { Recovery } from './tool-call-recovery.js';
export type { ChatResult, Message, TokenCounts, Tool, ToolCall } from './types.js';
