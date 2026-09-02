// The `/models use` presence guard (V5/02) — a thin, session-agnostic query against the HOST Ollama
// daemon.
//
// IT HAS NO CALLERS as of the tool-capability gate. `use-subcommand.ts` was the only one, and it now
// reads `listModels()` directly because presence stopped being the only question it has to ask — the
// same round trip answers "is it here?" and "can it call tools?", and re-listing for each would be two
// calls for one answer. Left in place rather than deleted: dead exports are
// [backlog/dead-exports-and-unused-imports.md](../../../backlog/dead-exports-and-unused-imports.md)'s
// subject, and that item's rule is to ask before removing one rather than assume.

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
