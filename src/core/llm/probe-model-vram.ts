// Measure ONE model's VRAM residency, by loading it and asking the daemon what it did.
//
// Measured, never predicted (backlog item 6, OPEN-QUESTIONS.md #100c). Ollama offers no way to ask the
// machine its capacity — `/api/status` carries no GPU data, `/api/ps` is empty until something loads,
// and `/api/experimental/model-recommendations` is a curated list with generic `vram_bytes` hints — so
// loading the thing and reading the result is the only option. It is also the portable one: a hardcoded
// ceiling or a vendor CLI would describe this box and no other.
//
// The protocol, verified live against Ollama 0.33.2:
//   1. `/api/generate` with an EMPTY prompt and `options.num_ctx` loads the model and generates
//      nothing — the reply comes back `done_reason: "load"`. That is the cheapest possible load.
//   2. `/api/ps` then reports the loaded row, including `size_vram` and (undeclared by the pinned
//      package, but present) a `context_length` that came back as exactly the num_ctx requested —
//      which is the cross-check that the ceiling under measurement is the ceiling asked for.
//   3. `/api/generate` with `keep_alive: 0` unloads it, `done_reason: "unload"`, and `/api/ps` goes
//      back to zero rows. Without step 3 a 20 GB blob would sit resident for Ollama's default five
//      minutes, competing with the model the session is about to load.
//
// IT CANNOT RUN WHILE A SESSION IS LIVE, and that is a product constraint rather than a caution:
// probing IS loading, so a probe during a turn would evict the session's own model mid-turn — exactly
// what docs/product.md's no-parallelism rule exists to prevent. The only caller is therefore the boot
// path (probe-pending-models.ts), before any turn has run.
//
// Cold-load cost is ~9-26 s per model depending on size (11.4 / 16.4 / 26.0 s were recorded for three
// of them; the two re-measured here took 9.0 s and 9.3 s warm-cache). It is paid once per
// (digest, num_ctx) and never again — see the cache beside it.

import { daemon } from './daemon.js';
import type { InstalledModel } from './list-models.js';
import { matchesModelName } from './matches-model-name.js';
import { readSizeVram } from './read-size-vram.js';
import type { VramMeasurement } from './vram-measurement.type.js';

/**
 * Load `model` at `numCtx`, read what Ollama put on the GPU, and unload it again. Returns the
 * measurement, or undefined when the daemon did not report a usable `size_vram` for it — undefined
 * means "not measured", which shows as no marker at all rather than as a bad verdict.
 *
 * THROWS if the daemon is unreachable or refuses the load, because the caller decides what a failed
 * probe costs: at boot it is one model left unmeasured, not a reason to refuse to start.
 */
export async function probeModelVram(
  model: InstalledModel,
  numCtx: number,
): Promise<VramMeasurement | undefined> {
  // An empty prompt is a load-only request (done_reason: "load"); num_ctx is what the verdict is
  // ABOUT, since the KV cache is the part that grows with the ceiling.
  await daemon.generate({ model: model.name, prompt: '', options: { num_ctx: numCtx } });
  try {
    const { models } = await daemon.ps();
    // matchesModelName holds the tag rule: the full tag exactly, or the implicit `:latest`. The daemon
    // echoes the name we asked for, but going through the shared predicate keeps the one rule in one
    // place — and other models may be loaded alongside, so the row still has to be picked out.
    const row = models.find((m) => matchesModelName(m.name, model.name));
    // readSizeVram narrows the RAW row: the pinned package declares `size_vram: number` for both
    // /api/tags and /api/ps, and /api/tags actually sends undefined — so the declared type is not
    // evidence the field is there. Undefined in means undefined out, never a zero.
    const sizeVramBytes = readSizeVram(row);
    if (sizeVramBytes === undefined) return undefined;
    return { weightsBytes: model.size, sizeVramBytes };
  } finally {
    // keep_alive: 0 evicts it immediately. In a `finally` so a failed read still gives the GPU back,
    // and swallowed because failing to unload is not a failure to MEASURE — the worst case is a blob
    // that lingers for Ollama's default five minutes, which is what would have happened anyway.
    try {
      await daemon.generate({ model: model.name, prompt: '', keep_alive: 0 });
    } catch {
      // Nothing to do and nothing to say: the measurement above is what the caller asked for.
    }
  }
}
