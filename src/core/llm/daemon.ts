// The one client the Ollama model-management wrappers (V5/02) talk to — a VALUE, not a function, which
// is why it gets its own module rather than living inside one of the three wrappers that share it
// (list-models.ts, has-model.ts, pull-model.ts) for `/models list | pull | use`.
//
// These are daemon queries (list installed models, pull a new blob, check presence), NOT per-turn chat,
// so they use their OWN default Ollama instance rather than OllamaClient (which carries the session
// model + num_ctx for turns). Same daemon (localhost:11434), different concern. Talking to the host
// daemon directly is correct: Ollama runs on the host GPU, never in the sandbox (CLAUDE.md
// "Sandboxing") — these are not sandboxed tool calls.

import { Ollama } from 'ollama';

/** One stateless client to the default local daemon; every wrapper reuses it (no per-call construction). */
export const daemon = new Ollama();
