// The boot pick rule: of the models actually installed, take the SMALLEST on disk.
//
// Why smallest and not "a default": there is no safe hard-coded default. A model name compiled into
// the orchestrator says nothing about what the user has pulled, so booting to one that isn't installed
// locks the session to a model every turn will fail on. The installed set is the only ground truth, and
// within it size is the only ordering that tracks the binding constraint — VRAM (CLAUDE.md: everything
// runs on one 3060). A 3B always beats a 14B, so an unattended boot picks the model most likely to fit.

import type { InstalledModel } from './ollama-models.type.js';

/**
 * The smallest installed model by on-disk bytes, or undefined when nothing is installed. Ties break on
 * name: `listModels` returns name-sorted and sort() is stable in Node, so the pick is deterministic
 * across boots rather than dependent on the daemon's listing order.
 */
export function pickSmallestModel(installed: readonly InstalledModel[]): InstalledModel | undefined {
  return [...installed].sort((a, b) => a.size - b.size)[0];
}
