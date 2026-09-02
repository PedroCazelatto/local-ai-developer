// ACCUMULATE, NEVER INVALIDATE — the whole of the probe cache's growth rule, kept pure so the property
// can be asserted without a filesystem (OPEN-QUESTIONS.md #103).
//
// The user's words for it: *"we dont need to invalidate, we can start mapping values for different
// num_ctx's as if the user changes it back to a known value, we dont need to reprobe."* So raising
// OLLAMA_NUM_CTX measures at the new ceiling and KEEPS every row taken at the old one; putting it back
// is free. The file only ever grows, and only ever by entries that were true when measured.
//
// The one case worth stating is a key already present. It is unreachable through the boot path —
// pendingProbes only ever asks for keys the cache does not hold — but if a caller does re-measure,
// the FRESH row wins: a measurement is the best available truth about its own key, and a key's
// identity already pins the digest and the ceiling, so the two rows describe the same thing anyway.

import type { ProbeCache } from './probe-cache.type.js';

/**
 * `existing` plus `fresh`, with no row ever removed. Neither input is mutated — the result is a new
 * object, so the caller can keep holding the cache it passed in. On a key present in both, `fresh`
 * wins (see the header for why that case cannot arise from boot).
 */
export function mergeProbeCache(existing: ProbeCache, fresh: ProbeCache): ProbeCache {
  return { ...existing, ...fresh };
}
