// A blocker the Reviewer raised (V3/02), persisted as a `raised` row in blockers.jsonl. A blocker is
// the Reviewer's "I cannot judge this -- the task itself is ambiguous" signal, and it is DURABLE so an
// unattended batch can be reviewed later and it survives a restart.

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
