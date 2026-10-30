// Which installed models still have no measurement at this ceiling — the decision half of the boot
// probe, kept pure so the cache's whole point can be asserted without loading anything.
//
// This function IS the "changing OLLAMA_NUM_CTX back costs nothing" property. Return it empty and
// nothing is probed; return a model and it costs ~18 s. So the accumulation rule is testable as a
// question about this list rather than as a question about elapsed time: probe at ceiling A, probe at
// ceiling B, come back to A, and this must answer nothing-to-do.
//
// It also answers the re-pull case for free, because the key's model half is the DIGEST
// (probe-cache-key.ts): a tag re-pulled as different bytes is a key nobody has seen, so it lands here
// and re-probes on its own.
//
// EVERY installed model is a candidate, tool-capable or not, because that is what the task file
// specifies ("by loading each installed model once at boot"). Worth knowing before changing it: on the
// box this was built for, three of nine models cannot call tools and so can never be selected, and
// their measurements are therefore never displayed — the gate refuses them and the marker column shows
// the refusal instead. Narrowing this to the selectable subset would save ~54 s of one-off boot time
// and lose nothing that is rendered. It is left as specified rather than optimised.

import type { InstalledModel } from '../llm/list-models.js';
import { probeCacheKey } from './probe-cache-key.js';
import type { ProbeCache } from './probe-cache.type.js';

/**
 * The subset of `installed` with no row in `cache` for `numCtx`, in the order given. Order is preserved
 * rather than sorted so the caller's progress lines follow the list the user was shown.
 */
export function pendingProbes(
  installed: readonly InstalledModel[],
  cache: ProbeCache,
  numCtx: number,
): readonly InstalledModel[] {
  // probeCacheKey: `<digest>@<numCtx>` — the digest so a re-pull re-probes, the ceiling because the KV
  // cache grows with it. Indexing is `| undefined` under noUncheckedIndexedAccess, which is the check.
  return installed.filter((m) => cache[probeCacheKey(m.digest, numCtx)] === undefined);
}
