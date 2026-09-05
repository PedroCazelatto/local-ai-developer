// One debate's result: the digest, or the reason there is none. Discriminated on `ok`, so a caller
// cannot read a digest that was never produced.

import type { DebateCost } from './debate-cost.type.js';
import type { DebateDigest } from './debate-digest.type.js';
import type { DebateFailure } from './debate-failure.type.js';

/** One debate's result: the digest, or the reason there is none. Discriminated on `ok`. */
export type DebateOutcome =
  | (DebateCost & { readonly ok: true; readonly digest: DebateDigest })
  | (DebateCost & { readonly ok: false; readonly failure: DebateFailure });
