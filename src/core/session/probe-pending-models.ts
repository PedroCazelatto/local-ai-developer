// The boot VRAM probe: measure whatever this machine has not measured yet, at this session's ceiling,
// and hand back every measurement it knows about (OPEN-QUESTIONS.md #100c, #103).
//
// WHERE IT SITS IN THE BOOT SEQUENCE IS THE CONSTRAINT, not a preference. Probing IS loading, so this
// can only run before any turn has: a probe during a session would evict the model mid-turn, which is
// the one thing docs/product.md's no-parallelism rule exists to prevent. resolveBootModel calls it
// once, before it prints a list or asks anything, and nothing else may call it. `/models list` reads
// the cache and never probes, for the same reason.
//
// IT ANNOUNCES ITSELF because it is the slowest thing in a cold boot: ~18 s per unmeasured model, so
// ~2.7 minutes for nine on a fresh install. Paid once per (digest, num_ctx) and never again — a boot
// with every row cached prints nothing at all, which is the normal case after the first one.
//
// A NEWLY PULLED MODEL IS MEASURED AT THE NEXT BOOT, not at the end of `/models pull` — the one thing
// the task file explicitly delegated. `/models pull` runs inside a live session with the session's
// model resident, so probing there would evict it and the next turn would pay a cold reload on top of
// the probe's own load: two loads instead of one, and a violation of the constraint above. Deferring
// costs nothing, because the pull leaves a digest the cache has never seen and pendingProbes finds it
// on its own with no new code path.
//
// A FAILED PROBE IS NOT A FAILED BOOT. One unmeasured model shows as one unmarked row; that is the
// direction the `too heavy` tag fails in, because it marks without refusing (#96a).

import { errMessage } from '../err-message.js';
import type { InstalledModel } from '../llm/list-models.js';
import { probeModelVram } from '../llm/probe-model-vram.js';
import type { VramMeasurement } from '../llm/vram-measurement.type.js';
import { renderer } from '../ui/renderer.js';
import { loadProbeCache } from './load-probe-cache.js';
import { mergeProbeCache } from './merge-probe-cache.js';
import { pendingProbes } from './pending-probes.js';
import { probeCacheFile } from './probe-cache-file.js';
import { probeCacheKey } from './probe-cache-key.js';
import type { ProbeCache } from './probe-cache.type.js';
import { saveProbeCache } from './save-probe-cache.js';

/**
 * Measure every installed model that has no row for `numCtx` yet, persist the new rows, and return the
 * whole cache — the measurements just taken plus every one taken before, at this ceiling and at others.
 *
 * Never throws. An unreachable daemon, a refused load or an unwritable cache all degrade to fewer
 * measurements, and fewer measurements means fewer markers rather than a broken boot.
 */
export async function probePendingModels(
  installed: readonly InstalledModel[],
  numCtx: number,
): Promise<ProbeCache> {
  // loadProbeCache: every measurement on disk, or {} when the file is absent (the reset gesture) or
  // unreadable. pendingProbes: the models with no row for this ceiling — digest-keyed, so a re-pull is
  // pending again.
  const cached = loadProbeCache();
  const pending = pendingProbes(installed, cached, numCtx);
  if (pending.length === 0) return cached;

  // Three lines rather than one, and the reason is 80 columns: the cache file's ABSOLUTE path is
  // 51 characters on this box (`C:\Users\<name>\.local-ai-developer\vram-probes.json`) and unbounded in
  // general, so anything sharing a line with it wraps. It gets a line of its own; the sentences beside
  // it are then short enough to be checked. `10-30 s` rather than the task file's `~18 s` average:
  // 11.4 / 16.4 / 26.0 s were recorded cold and 7.0 s warm, and a range does not pretend to precision.
  renderer.systemMessage(
    `Measuring VRAM for ${pending.length} model${pending.length === 1 ? '' : 's'} at num_ctx ${numCtx} — 10-30 s each, then cached.`,
  );
  renderer.systemMessage(`  ${probeCacheFile()}`);
  renderer.systemMessage('  Delete that file to re-measure (safe at any time).');

  const fresh: Record<string, VramMeasurement> = {};
  let index = 0;
  for (const model of pending) {
    index += 1;
    renderer.systemMessage(`  probing ${index}/${pending.length}: ${model.name}`);
    try {
      // probeModelVram loads the model at numCtx, reads size_vram off /api/ps, and unloads it again.
      // Undefined means the daemon reported no usable figure — not measured, so no row is written.
      const measured = await probeModelVram(model, numCtx);
      if (measured !== undefined) fresh[probeCacheKey(model.digest, numCtx)] = measured;
    } catch (err) {
      // The daemon's own message is unbounded, so this line is not width-bindable the way the fixed
      // ones above are — the prefix is kept minimal for that reason, and the line stands alone.
      renderer.systemMessage(`  ${model.name}: not measured (${errMessage(err)})`);
    }
  }

  try {
    // saveProbeCache merges over what is on disk (never replacing it) and returns the merged result.
    return saveProbeCache(fresh);
  } catch (err) {
    renderer.systemMessage(`  could not save the VRAM measurements: ${errMessage(err)}`);
    // The session still gets this boot's measurements; only their persistence was lost.
    return mergeProbeCache(cached, fresh);
  }
}
