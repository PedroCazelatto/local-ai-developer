// The one client the Ollama model-management wrappers (V5/02) talk to — a VALUE, not a function, which
// is why it gets its own module rather than living inside one of the wrappers that share it
// (list-models.ts, has-model.ts, pull-model.ts, delete-model.ts) for `/models list | pull | use`.
//
// One read does NOT come through here: `/api/version`, which the package wraps at no version, so the
// boot floor check fetches it directly. Both therefore need the address, so the address is stated ONCE
// -- in ollama-host.ts -- and passed in below rather than left to the package's default. Passing it is
// not a behaviour change: `ollama` 0.5.18 defaults to `http://127.0.0.1:${defaultPort}`
// (dist/browser.mjs:3-4), the same string OLLAMA_HOST holds, and driving both constructions against the
// live daemon returned the same 9 models (with a wrong-host control proving the comparison could fail).
// It is what stops the two readers drifting onto different addresses.
//
// These are daemon queries (list installed models, pull a new blob, check presence, delete a blob),
// NOT per-turn chat, so they use their OWN default Ollama instance rather than OllamaClient (which
// carries the session model + num_ctx for turns). Same daemon (localhost:11434), different concern.
// Talking to the host daemon directly is correct: Ollama runs on the host GPU, never in the sandbox
// (CLAUDE.md "Sandboxing") — these are not sandboxed tool calls.

import { Ollama } from 'ollama';

import { OLLAMA_HOST } from './ollama-host.js';

/** One stateless client to the local daemon; every wrapper reuses it (no per-call construction). */
export const daemon = new Ollama({ host: OLLAMA_HOST });
