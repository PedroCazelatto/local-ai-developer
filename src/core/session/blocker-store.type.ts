// Types for the blocker store (V3/02), beside blocker-store.ts (constitution: types live in a
// sibling file, never inline). A blocker is the Reviewer's "I cannot judge this — the task itself is
// ambiguous/under-specified/self-contradictory" signal. It is DURABLE (append-only JSONL) so an
// unattended batch (V3/05) can be reviewed later and a blocker survives a restart; open-vs-resolved
// state is reconstructed by REPLAY, never mutated in place.

/** A blocker the Reviewer raised (persisted as a `raised` row). */
export interface RaisedBlocker {
  /**
   * `${taskId}#${n}` — n is a 1-based counter of blockers raised for THIS task (a task can be
   * re-blocked across re-runs). Human-readable + sortable within a task, and the key a `resolved`
   * row references. The user chose this over a ULID (there is no id dependency yet — V3/04's inbox).
   */
  readonly id: string;
  /** The backlog task id (path under backlog/ without .md) the blocker was raised on. */
  readonly taskId: string;
  /** The fix-loop round (1..MAX_ROUNDS) the blocker was raised on. */
  readonly round: number;
  /** The Reviewer's question — surfaced to the user, answered later via /answer. */
  readonly question: string;
  /** UTC ISO-8601 ms, when the blocker was raised. */
  readonly raisedAt: string;
}

/** The user's answer to a blocker (persisted as a `resolved` row referencing the raised `id`). */
export interface ResolvedBlocker {
  /** The `id` of the `raised` row this answers. */
  readonly id: string;
  /** The user's answer text (from /answer). */
  readonly answer: string;
  /** UTC ISO-8601 ms, when the user answered. */
  readonly resolvedAt: string;
}

/** One append-only row in blockers.jsonl, discriminated by `kind`. State = replay of these rows. */
export type BlockerRow =
  | ({ readonly kind: 'raised' } & RaisedBlocker)
  | ({ readonly kind: 'resolved' } & ResolvedBlocker);
