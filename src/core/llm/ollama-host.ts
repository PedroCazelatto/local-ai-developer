// The daemon's base URL — THE one place it is written down, for the two readers that need it.
//
// It exists because the `ollama` package has no `/api/version` method at any version published, so the
// boot floor check (src/boot/ollama-version-refusal.ts) has to fetch that endpoint itself: a single
// unauthenticated GET. Everything else goes through daemon.ts — which is handed this same constant, so
// the raw fetch and the client cannot drift onto different addresses. It is stated here rather than
// read off the client because the package keeps its own `config.host` `protected`.
//
// `ollama` 0.5.18 would default to this exact string anyway (`http://127.0.0.1:${defaultPort}`,
// dist/browser.mjs:3-4) and reads NO environment variable for it, so passing it changes no behaviour;
// it only removes the second copy. If this ever needs to come from the environment, this is the one
// line that changes.

/** Base URL of the HOST Ollama daemon — the same address `new Ollama()` defaults to. */
export const OLLAMA_HOST = 'http://127.0.0.1:11434';
