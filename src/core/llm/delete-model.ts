// `/models use` on a toolless model — the delete half of the refusal (OPEN-QUESTIONS.md #69).
//
// A thin, session-agnostic call against the HOST Ollama daemon, like its three neighbours. It exists
// only because a refusal that leaves the model sitting there is a thing the user has to remember
// about: shown, explained, and DISPOSABLE is the whole shape. Nothing calls this without an explicit
// keypress first — deleting a blob is the one irreversible thing `/models` can do.

import { daemon } from './daemon.js';

/**
 * Delete `name`'s blob from the local daemon. `name` must be a full tag from `listModels`, not a
 * user-typed abbreviation: Ollama deletes exactly what it is given, so resolving the tag is the
 * caller's job (matchesModelName) and not a thing to guess here. THROWS on any daemon error, for the
 * caller to surface as one recoverable line.
 */
export async function deleteModel(name: string): Promise<void> {
  await daemon.delete({ model: name });
}
