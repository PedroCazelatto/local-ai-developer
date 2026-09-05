// The residency verdict — the arithmetic behind the `too heavy` tag, and the one piece of this task
// that had to be re-derived rather than copied.
//
// THE TASK FILE'S OWN WORDING IS NOT THE PREDICATE. It says `size_vram < size` "is the spill", which is
// true and is not the verdict: docs/product.md's rule is that spill is acceptable *while the weights
// stay resident and only KV cache offloads*, so a model can spill and be fine. Its measured table
// proves the two differ — qwen2.5-coder:14b spills 1.93 GB and is listed as resident, because the
// spill is all KV cache. Using `size_vram < size` as the tag would mark it too heavy and contradict the
// table it sits beside.
//
// So the verdict compares the WEIGHTS against what stayed on the GPU: the weights are resident exactly
// when the on-disk size fits inside `size_vram`. That is also the arithmetic the task file used to
// produce its own annotation — codestral:22b's 12.57 GB on disk against 10.70 GB in VRAM is the
// "~1.9 GB of *weights* on the CPU" it records.
//
// Reproduced against all five measured rows, and re-measured live for two of them (num_ctx 16 384):
//
//   model              on disk    size_vram   on disk <= size_vram   task file says
//   qwen2.5-coder:14b   8.99 GB    10.49 GB   yes                    resident
//   codestral:22b      12.57 GB    10.70 GB   no  (1.87 GB over)     not resident, "~1.9 GB of weights"
//   gpt-oss:20b        13.79 GB    10.20 GB   no                     not resident
//   qwen3-coder:30b    18.56 GB    10.61 GB   no                     not resident
//   qwen2.5-coder:32b  19.85 GB    10.35 GB   no                     not resident
//
// The two live rows came back byte-for-byte on the figures the table records (10 489 209 814 and
// 10 702 249 000), so the table is reproducible measurement rather than a snapshot.
//
// Units are not a hazard here even though the table is in GB and the API is in bytes: both sides of
// the comparison are bytes from the same daemon, so the GB-versus-GiB question only ever affects how a
// number is PRINTED. It is never load-bearing for the verdict.

import type { VramMeasurement } from './vram-measurement.type.js';

/**
 * Whether the model's weights all fit in the VRAM Ollama actually gave it — the `too heavy` tag is the
 * negation of this. `<=` rather than `<` on purpose: weights that exactly fill the resident bytes are
 * resident, and the boundary is the one case worth being explicit about.
 *
 * Reading it the other way round is what makes it honest: when `size_vram` is BELOW the weights, some
 * weight bytes provably sit outside VRAM, and every token of those layers crosses the bus.
 */
export function weightsResident(measurement: VramMeasurement): boolean {
  return measurement.weightsBytes <= measurement.sizeVramBytes;
}
