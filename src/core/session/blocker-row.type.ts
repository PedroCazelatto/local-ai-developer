// One append-only row in blockers.jsonl, discriminated by `kind`. Open-vs-resolved is reconstructed by
// REPLAY of these rows, never mutated in place: a `raised` row whose id has no `resolved` row is open.

import type { RaisedBlocker } from './raised-blocker.type.js';
import type { ResolvedBlocker } from './resolved-blocker.type.js';

/** One append-only row in blockers.jsonl, discriminated by `kind`. State = replay of these rows. */
export type BlockerRow =
  | ({ readonly kind: 'raised' } & RaisedBlocker)
  | ({ readonly kind: 'resolved' } & ResolvedBlocker);
