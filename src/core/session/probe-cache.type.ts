// The whole of ~/.local-ai-developer/vram-probes.json: `(digest, num_ctx) → measurement`, flattened to
// a string key so the file is plain JSON a human can read and delete.
//
// Owned by no function — loadProbeCache parses one, mergeProbeCache combines two, saveProbeCache writes
// one and two display surfaces read one — so it is the folder's vocabulary and gets its own file
// (constitution.md, "A type no function owns gets its own file").

import type { VramMeasurement } from '../llm/vram-measurement.type.js';

/**
 * Every VRAM measurement this machine has ever taken, keyed by probeCacheKey(digest, numCtx).
 *
 * IT ACCUMULATES AND NEVER INVALIDATES (OPEN-QUESTIONS.md #103). Raising OLLAMA_NUM_CTX adds rows at
 * the new ceiling and keeps the old ones, so putting it back costs nothing. Indexing yields
 * `| undefined` under `noUncheckedIndexedAccess`, which is the only "is this measured?" check any
 * reader needs.
 */
export type ProbeCache = Readonly<Record<string, VramMeasurement>>;
