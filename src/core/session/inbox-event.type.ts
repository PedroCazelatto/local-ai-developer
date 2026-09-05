// One append-only row in a recipient's `<phase>.jsonl`, discriminated by `kind`. State is the replay of
// these -- a `post` creates an item and a later `resolve` overlays it; nothing is ever edited on disk.

import type { Phase } from './phase.type.js';

/** One append-only row in a recipient's `<phase>.jsonl`, discriminated by `kind`. State = replay of these. */
export type InboxEvent =
  | {
      readonly kind: 'post';
      readonly id: string;
      readonly from: Phase;
      readonly to: Phase;
      readonly created: string;
      readonly body: string;
    }
  | {
      readonly kind: 'resolve';
      readonly id: string;
      readonly by: Phase;
      readonly resolved: string; // UTC ISO-8601 ms
      readonly note: string;
    };
