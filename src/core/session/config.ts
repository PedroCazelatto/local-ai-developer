// Session configuration: resolved once at boot and read-only thereafter.
//
// This file holds NO function of its own. It keeps the DEFAULT_* constants and re-exports the
// single-function modules beside it — resolve-num-ctx.ts, resolve-ratio.ts, resolve-timeout-ms.ts and
// load-config.ts — so `loadConfig(projectName)` stays the one entry point while the constitution's
// one-function-per-file rule holds. The shape it assembles is SessionConfig, declared with the
// function that builds it in load-config.ts.

/**
 * The model we SUGGEST DOWNLOADING when Ollama has nothing installed at all — a starting point for a
 * fresh machine, never a value the session silently boots on. It was formerly DEFAULT_MODEL, the boot
 * fallback, which was the bug: a hard-coded name says nothing about what is actually pulled, so a fresh
 * install booted locked to a model that did not exist and every turn failed. The boot model now comes
 * from the installed set (resolve-boot-model.ts); this name only ever reaches the user as an offer.
 * A 3B is deliberate for the suggestion: it is the least likely first download to not fit.
 */
export const SUGGESTED_MODEL = 'qwen2.5-coder:3b';
/** num_ctx is a hard VRAM ceiling — never estimated or invented (CLAUDE.md memory model). */
export const DEFAULT_NUM_CTX = 16384;
export const DEFAULT_PHASE = 'discovery';
/**
 * Summarization failsafe trigger (V4/05): compact a phase once its EXACT prompt_eval_count reaches
 * this fraction of num_ctx. 0.75 leaves headroom for the next response + tool-result payloads.
 */
export const DEFAULT_SUMMARIZATION_THRESHOLD_RATIO = 0.75;
/**
 * Tool-result eviction trigger: stub older tool results in a spawned window once its EXACT
 * prompt_eval_count reaches this fraction of num_ctx (see evict-stale-tool-results.ts).
 *
 * Deliberately BELOW the summarization ratio above. Eviction is the cheaper instrument — it costs no
 * inference at all, and the measurement behind it showed a late rewrite costs less prompt-evaluation
 * than a plain append — so it should get a clear run at reclaiming the window before the blunter
 * failsafe would have fired.
 *
 * 0.6 is a PROPOSAL, not a measurement. Nothing was measured that says 0.6 is better than 0.55 or 0.65;
 * what was measured is only that eviction is cheap when it cuts late, which argues for "earlier than
 * 0.75" and no more than that. Tune it against real runs rather than treating it as derived.
 */
export const DEFAULT_EVICTION_THRESHOLD_RATIO = 0.6;
/**
 * How long ONE model call may go silent before it is abandoned (OLLAMA_TIMEOUT_MS). This is a STALL
 * window, not a cap on how long a turn may take: every chunk that arrives restarts it, so a 14–32b model
 * that spends nine legitimate minutes on a turn never trips it, while an unreachable or wedged daemon
 * surfaces as one recoverable line instead of a REPL that hangs forever. A non-streamed one-shot has no
 * chunks to restart it and so is capped outright at this value. See core/llm/begin-model-call.ts.
 */
export const DEFAULT_TIMEOUT_MS = 120_000;

// The assembly and the env resolvers it calls, one function per file. Each resolver reads ONE env var
// and falls back loudly to the matching DEFAULT_* above; loadConfig validates the project folder and
// puts their results into a SessionConfig.
export { loadConfig } from './load-config.js';
export { resolveNumCtx } from './resolve-num-ctx.js';
export { resolveRatio } from './resolve-ratio.js';
export { resolveTimeoutMs } from './resolve-timeout-ms.js';
export type { SessionConfig } from './load-config.js';
