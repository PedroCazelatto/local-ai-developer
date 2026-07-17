// Ollama model-management wrappers (V5/02) — thin, session-agnostic calls to the HOST Ollama daemon for
// `/models list | pull | use`. These are daemon queries (list installed models, pull a new blob, check
// presence), NOT per-turn chat, so they use their OWN default Ollama instance rather than OllamaClient
// (which carries the session model + num_ctx for turns). Same daemon (localhost:11434), different
// concern. Talking to the host daemon directly is correct: Ollama runs on the host GPU, never in the
// sandbox (CLAUDE.md "Sandboxing") — these are not sandboxed tool calls.
//
// A cohesive module (list / hasModel / pullModel over the one daemon), not one function per file.

import { Ollama } from 'ollama';

import { matchesModelName } from './matches-model-name.js';
import type { InstalledModel, PullOutcome, PullProgressHandler } from './ollama-models.type.js';

/** One stateless client to the default local daemon; every wrapper reuses it (no per-call construction). */
const daemon = new Ollama();

/** List locally-installed models, projected to { name, size, modifiedAt } and sorted by name. */
export async function listModels(): Promise<InstalledModel[]> {
  const { models } = await daemon.list();
  return models
    .map((m) => ({ name: m.name, size: m.size, modifiedAt: m.modified_at }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Whether `name` is actually pulled locally — the guard `/models use` runs so we never send an unknown
 * model to Ollama. matchesModelName holds the tag rule (exact, or the implicit `:latest` when tagless).
 * Callers that ALREADY hold a listModels() result should match against it directly rather than call this
 * (it re-lists); this is the convenience form for a one-off check.
 */
export async function hasModel(name: string): Promise<boolean> {
  const installed = await listModels();
  return installed.some((m) => matchesModelName(m.name, name));
}

/**
 * Pull `name` from the registry, STREAMING progress to `onProgress` and BLOCKING until the pull finishes
 * (the caller must not let `/models use` proceed before this resolves). `signal` (from the REPL's Ctrl-C
 * handler) aborts the in-flight request cleanly: on abort we tear down only THIS streamed request via the
 * iterator's own abort() and return `{ cancelled: true }` — no throw, no half-state in the session (a
 * partial blob is Ollama's to garbage-collect). Any real network/registry error still throws for the
 * caller to surface as a recoverable message.
 */
export async function pullModel(
  name: string,
  onProgress: PullProgressHandler,
  signal: AbortSignal,
): Promise<PullOutcome> {
  // stream:true yields an AbortableAsyncIterator whose abort() cancels the underlying fetch. The `ollama`
  // package exposes no per-request signal param, so we bridge the caller's AbortSignal onto it ourselves.
  const iterator = await daemon.pull({ model: name, stream: true });
  if (signal.aborted) {
    iterator.abort();
    return { cancelled: true };
  }
  const onAbort = (): void => iterator.abort();
  signal.addEventListener('abort', onAbort, { once: true });
  try {
    for await (const progress of iterator) {
      onProgress(progress);
    }
    return { cancelled: false };
  } catch (err) {
    // An abort surfaces here as a rejected iteration; signal.aborted disambiguates it from a real error.
    if (signal.aborted) return { cancelled: true };
    throw err;
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}
