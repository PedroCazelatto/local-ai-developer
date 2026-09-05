// One cross-phase message, folded from its `post` event plus any later `resolve`. This is what a phase
// actually sees; the events behind it are the durable form.

import type { Phase } from './phase.type.js';

/** One cross-phase message, folded from its `post` (+ optional `resolve`) event(s). */
export interface InboxItem {
  /**
   * Project-global sequential id (a plain integer as a string) — unique across every recipient file,
   * monotonic by creation (so numeric order IS chronological order), and the key a `resolve`
   * references. A simple sequential number was substituted for a ULID by the user's decision.
   */
  readonly id: string;
  readonly from: Phase;
  readonly to: Phase;
  /** UTC ISO-8601 ms, when the message was posted. */
  readonly created: string;
  readonly body: string;
  readonly resolved: boolean;
  /** UTC ISO-8601 ms — present only once resolved. */
  readonly resolvedAt?: string;
  /** The phase that resolved it — may differ from `to` (any phase may resolve). Present once resolved. */
  readonly resolvedBy?: Phase;
  /** The one-line resolution note — present only once resolved. */
  readonly note?: string;
}
