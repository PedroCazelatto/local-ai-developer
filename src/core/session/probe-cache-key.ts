// The probe cache's key: the two things a VRAM verdict actually depends on.
//
// THE MODEL HALF IS THE DIGEST, NOT THE NAME, and that single choice is what makes "never invalidate"
// correct rather than merely convenient (OPEN-QUESTIONS.md #103). A tag is not an identity: `:latest`
// — or any tag the publisher moves — can be re-pulled as different bytes, and a name-keyed row would
// then describe a model that no longer exists. That is the one stale case a cache with no invalidation
// could not survive. Keyed on the digest, a re-pull is simply a key nobody has seen, so it re-probes
// on its own and the old row sits there harmlessly describing bytes that are gone.
//
// THE NUM_CTX HALF is there because the KV cache is the part that grows with the ceiling (#96): the
// same model is too heavy at one num_ctx and fine at another, so a verdict without a ceiling is not a
// verdict. `/api/tags` already returns `digest` in the same call that returns `capabilities` and
// `size`, so neither half costs a round trip.

/**
 * The cache key for one measurement. `digest` is the bare hex `/api/tags` reports — measured live, and
 * with NO `sha256:` prefix, so nothing here strips or adds one. The `@` is a separator neither half can
 * contain (a digest is hex, a num_ctx is digits), so distinct pairs cannot collide on one key.
 */
export function probeCacheKey(digest: string, numCtx: number): string {
  return `${digest}@${numCtx}`;
}
