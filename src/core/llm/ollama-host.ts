// The daemon's base URL, for the ONE read that the `ollama` package cannot make for us.
//
// It is not a second source of truth by choice. `ollama` 0.5.18 resolves its host to
// `http://127.0.0.1:${11434}` in dist/browser.mjs:4 and reads NO environment variable for it, and the
// instance daemon.ts builds takes that default — so this constant and `new Ollama()` name the same
// address by construction. The package exposes its own `config.host` as `protected`, which is why the
// value is written here rather than read off the client.
//
// It exists because the package has no `/api/version` method at any version pinned here, and the boot
// floor check (src/boot/ollama-version-refusal.ts) needs one: `/api/version` is a single
// unauthenticated GET. Everything else goes through daemon.ts.

/** Base URL of the HOST Ollama daemon — the same address `new Ollama()` defaults to. */
export const OLLAMA_HOST = 'http://127.0.0.1:11434';
