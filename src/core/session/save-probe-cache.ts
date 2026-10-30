// Write ~/.local-ai-developer/vram-probes.json. Same shape as save-app-state.ts, for the same reasons:
// single-process and single-writer (no parallelism — CLAUDE.md), so the load-merge-write below is
// race-free, and a temp-then-rename keeps a kill mid-write from leaving a torn file the next boot
// cannot parse.
//
// It MERGES over what is on disk rather than replacing it, which is the accumulate rule reaching the
// filesystem: a caller that measured three models at one ceiling must not erase the twelve rows
// somebody measured at another.

import { mkdirSync, renameSync, writeFileSync } from 'node:fs';

import { appStateDir } from './app-state-dir.js';
import { loadProbeCache } from './load-probe-cache.js';
import { mergeProbeCache } from './merge-probe-cache.js';
import { probeCacheFile } from './probe-cache-file.js';
import type { ProbeCache } from './probe-cache.type.js';

/**
 * Add `fresh` to the measurements already on disk and write the result, returning the merged cache so
 * the caller can display it without re-reading. Creates ~/.local-ai-developer on first write.
 *
 * THROWS on an I/O failure, and the boot caller catches it: an unwritable cache costs one more probe
 * next boot, which is not a reason to refuse to start a session.
 */
export function saveProbeCache(fresh: ProbeCache): ProbeCache {
  // appStateDir: ~/.local-ai-developer, resolved via os.homedir().
  mkdirSync(appStateDir(), { recursive: true });
  // loadProbeCache: what is on disk, or {} when absent/corrupt. mergeProbeCache: accumulate, never drop.
  const merged = mergeProbeCache(loadProbeCache(), fresh);
  const file = probeCacheFile();
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(merged, null, 2)}\n`);
  renameSync(tmp, file);
  return merged;
}
