// Session configuration: resolved once at boot and read-only thereafter.
//
// This file is an ASSEMBLER and holds NO function of its own. It exports exactly one value — the
// `config` object — which carries the SUGGESTED_*/DEFAULT_* constants together with the
// single-function modules beside it: load-config.ts and the three env resolvers (resolve-num-ctx.ts,
// resolve-ratio.ts, resolve-timeout-ms.ts). Constants and functions alike are properties of the object
// rather than separate exports, so `config.loadConfig(projectName)` stays the one entry point and a
// caller takes the whole concept from one import (constitution.md, "A split file survives only if it
// assembles the parts into an object"). `SessionConfig` rides along as a TYPE export — a type is not a
// value, so it costs the object nothing — while the interface itself is declared in load-config.ts,
// with the function that builds it.
//
// TDZ WARNING, and it is measured rather than cautionary: this object sits in an import CYCLE on
// purpose. load-config.ts, resolve-num-ctx.ts and resolve-timeout-ms.ts read their fallbacks back out
// of `config`, so they import this file while this file imports them. Every such read MUST happen
// INSIDE A FUNCTION BODY. A module-evaluation-time read — a top-level `const CAP =
// config.DEFAULT_NUM_CTX`, or a top-level destructure — runs before this binding is initialised and
// throws `ReferenceError: Cannot access 'config' before initialization`. The other direction is safe
// for a reason worth knowing before anyone edits the four members below: they are all hoisted
// `function` declarations, so their bindings exist before any module body runs and the object literal
// may name them whichever way round the graph is entered. An arrow const would NOT be safe there.
// Driven against Node's ESM loader in all four entry orders — at this file, at a resolver, at
// load-config.ts, and through a dynamic import — plus the failing shape. See constitution.md, "Any
// module-level value read across an import cycle must be read inside a function body".

import { loadConfig } from './load-config.js';
import { resolveNumCtx } from './resolve-num-ctx.js';
import { resolveRatio } from './resolve-ratio.js';
import { resolveTimeoutMs } from './resolve-timeout-ms.js';

export type { SessionConfig } from './load-config.js';

export const config = {
  /**
   * The model we SUGGEST DOWNLOADING when Ollama has nothing installed at all — a starting point for a
   * fresh machine, never a value the session silently boots on. It was formerly DEFAULT_MODEL, the boot
   * fallback, which was the bug: a hard-coded name says nothing about what is actually pulled, so a fresh
   * install booted locked to a model that did not exist and every turn failed. The boot model now comes
   * from the installed set (resolve-boot-model.ts); this name only ever reaches the user as an offer.
   * A 3B is deliberate for the suggestion: it is the least likely first download to not fit.
   */
  SUGGESTED_MODEL: 'qwen2.5-coder:3b',
  /** num_ctx is a hard VRAM ceiling — never estimated or invented (CLAUDE.md memory model). */
  DEFAULT_NUM_CTX: 16384,
  DEFAULT_PHASE: 'discovery',
  /**
   * Summarization failsafe trigger (V4/05): compact a phase once its EXACT prompt_eval_count reaches
   * this fraction of num_ctx. 0.75 leaves headroom for the next response + tool-result payloads.
   */
  DEFAULT_SUMMARIZATION_THRESHOLD_RATIO: 0.75,
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
  DEFAULT_EVICTION_THRESHOLD_RATIO: 0.6,
  /**
   * How long ONE model call may go silent before it is abandoned (OLLAMA_TIMEOUT_MS). This is a STALL
   * window, not a cap on how long a turn may take: every chunk that arrives restarts it, so a 14–32b model
   * that spends nine legitimate minutes on a turn never trips it, while an unreachable or wedged daemon
   * surfaces as one recoverable line instead of a REPL that hangs forever. A non-streamed one-shot has no
   * chunks to restart it and so is capped outright at this value. See core/llm/begin-model-call.ts.
   */
  DEFAULT_TIMEOUT_MS: 120_000,

  // The assembly and the env resolvers it calls, one function per file. Each resolver reads ONE env var
  // and falls back loudly to the matching DEFAULT_* above; loadConfig validates the project folder and
  // puts their results into a SessionConfig.
  loadConfig,
  resolveNumCtx,
  resolveRatio,
  resolveTimeoutMs,
} as const;
