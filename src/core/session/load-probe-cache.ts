// Read ~/.local-ai-developer/vram-probes.json. A MISSING FILE IS THE NORMAL CASE and says nothing:
// it is both the fresh-install state and the documented reset gesture, so warning about it would train
// the user to ignore the warning they were told to cause.
//
// A corrupt file DOES warn — same as loadAppState — and then reads as empty, so boot re-measures
// rather than crashing over a file nobody's session depends on.

import { existsSync, readFileSync } from 'node:fs';

import { narrowProbeCache } from './narrow-probe-cache.js';
import { probeCacheFile } from './probe-cache-file.js';
import type { ProbeCache } from './probe-cache.type.js';

/**
 * Every measurement this machine has recorded, or `{}` when there is nothing usable to read. Never
 * throws: an absent file, an unparseable one and one full of nonsense all mean the same thing to the
 * caller — nothing is measured yet — and the only cost of being wrong is an unmarked row.
 */
export function loadProbeCache(): ProbeCache {
  // probeCacheFile: ~/.local-ai-developer/vram-probes.json, beside state.json.
  const file = probeCacheFile();
  if (!existsSync(file)) return {};
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf-8'));
    // narrowProbeCache: drops any row that is not two usable byte counts, keeping the rest.
    return narrowProbeCache(parsed);
  } catch {
    console.warn(`Warning: could not parse ${file}; ignoring it. Delete it to re-measure.`);
    return {};
  }
}
