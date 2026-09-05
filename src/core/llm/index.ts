// core/llm/ — Ollama client: chat + stream + tool-calling, num_ctx option, and EXACT
// token counts read from prompt_eval_count / eval_count (never estimated).
export { OllamaClient } from './client.js';
export type { StreamHandle } from './client.js';
// Every model call names the ROLE it plays, and that role is what picks its num_ctx ceiling. The union
// is closed, so a call site cannot invent one; resolveWindowCtx is the single place a ceiling is chosen.
export type { CallRole, OneShotRole, WindowRole } from './types.js';
export { resolveWindowCtx } from './resolve-window-ctx.js';
// V4/02: a fresh, history-free Ollama call (same model, not in session memory, ceiling from its role) —
// used by search_rules and shared with summarization (V4/05).
export { oneShot } from './one-shot.js';
export type { OneShotResult } from './one-shot.js';
// V5/02: daemon model-management wrappers (list / pull / hasModel) for the `/models` command. One
// function per file over the one shared daemon client in daemon.js.
export { listModels } from './list-models.js';
export { hasModel } from './has-model.js';
export { pullModel } from './pull-model.js';
// The boot pick rule + the shared name/tag match, used by resolve-boot-model and `/models`.
export { pickSmallestModel } from './pick-smallest-model.js';
export { matchesModelName } from './matches-model-name.js';
export type { InstalledModel } from './list-models.js';
export type { PullProgress, PullProgressHandler, PullOutcome } from './pull-model.js';
// Cancellation: every aborted model call — Ctrl+C or a stalled daemon — surfaces as this one error, on
// both the streamed and the non-streamed path, so one instanceof check covers every window.
export { TurnAbortedError } from './turn-aborted-error.js';
export type { TurnAbortReason } from './turn-aborted-error.js';
export { StreamFilter } from './stream-filter.js';
// Tolerant JSON decoding, one function per file: the whole-string parse callers want, and the
// partial decode it is built on (tool-call recovery needs the partial one).
export { loadsOrRepair } from './loads-or-repair.js';
export { repairDecode } from './repair-decode.js';
export { recoverToolCalls } from './recover-tool-calls.js';
export type { Recovery } from './recover-tool-calls.js';
export type { ChatResult, Message, TokenCounts, Tool, ToolCall } from './types.js';
