// An Ollama handle whose every request carries an AbortSignal — the ONLY way to abort a non-streamed
// chat with this package.
//
// The asymmetry is in the package, not in this code, and it is worth stating because it is invisible
// from the outside: `ollama` opens its own AbortController for `stream: true` and hands it back as the
// iterator's abort() (which is what pull-model.ts bridges onto for `/models pull`), but a
// `stream: false` request is a bare fetch with NO signal argument at all — so `Ollama.abort()` cannot
// reach it and neither can anything else. Injecting the signal at the `fetch` seam the constructor
// already exposes is the one hook that covers that path.
//
// A handle is built PER CALL rather than shared and mutated. An Ollama instance is a config holder, so
// this costs an object; what it buys is that the signal is captured in the closure instead of read from
// a mutable field, which means correctness here never rests on the "one request in flight at a time"
// property the rest of the orchestrator happens to have.

import { Ollama } from 'ollama';

/**
 * An Ollama client for one call, aborted by `signal`. Any signal the package supplies for its own
 * streamed requests is preserved and combined, so bridging this onto a stream would abort on either —
 * the caller's cancel or the package's own teardown — rather than silently replacing one with the other.
 */
export function ollamaWithSignal(signal: AbortSignal): Ollama {
  return new Ollama({
    fetch: (input, init) => {
      const inner = init?.signal;
      return fetch(input, {
        ...init,
        signal: inner === undefined || inner === null ? signal : AbortSignal.any([inner, signal]),
      });
    },
  });
}
