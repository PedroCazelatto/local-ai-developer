// The `/models use` presence guard (V5/02) — a thin, session-agnostic query against the HOST Ollama
// daemon.

import { listModels } from './list-models.js';
import { matchesModelName } from './matches-model-name.js';

/**
 * Whether `name` is actually pulled locally — the guard `/models use` runs so we never send an unknown
 * model to Ollama. matchesModelName holds the tag rule (exact, or the implicit `:latest` when tagless).
 * Callers that ALREADY hold a listModels() result should match against it directly rather than call this
 * (it re-lists); this is the convenience form for a one-off check.
 */
export async function hasModel(name: string): Promise<boolean> {
  // listModels asks the daemon for every installed model, name-sorted.
  const installed = await listModels();
  return installed.some((m) => matchesModelName(m.name, name));
}
