// Types for the cross-phase inbox store (V3/04), beside inbox-store.ts (constitution: types live in a
// sibling file, never inline). The inbox is how one phase signals another despite each phase window
// having its OWN isolated history — a durable, append-only JSONL channel that replaces the fragile
// AGENT_NOTES.md markdown file (CLAUDE.md / ROADMAP V3). Open-vs-resolved state is reconstructed by
// REPLAY of the events, never mutated in place.

/** The closed set of phases — the only valid inbox sender/recipient (mirrors the six rules/phases files). */
export type Phase = 'Discovery' | 'Design' | 'Breakdown' | 'Worker' | 'Reviewer' | 'Retro';

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

/** `inbox_read`'s status filter: only-open (default) or the full history including resolved items. */
export type InboxReadStatus = 'open' | 'all';

/** Why an `inbox_post` was rejected (structured, recoverable — the model reads it and retries). */
export type InboxPostError = 'unknown_to_phase' | 'empty_body';

/** Why an `inbox_resolve` was rejected (structured, recoverable). */
export type InboxResolveError = 'unknown_id' | 'already_resolved';

/** `inbox_resolve` outcome: the resolved id, or a structured rejection (never a thrown error). */
export type InboxResolveResult =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly error: InboxResolveError; readonly message: string };
