// One harness event as the /events listing sees it. Its own module because the reader builds it and the
// formatter and the display consume it — none of the three owns it more than the others, exactly like
// audit-row.type.ts beside it.

/** One row of memory.db's `events` table, narrowed to what /events prints. */
export interface EventRow {
  /** UTC ISO-8601 ms, stamped when the event was written. */
  readonly ts: string;
  /** The event type, e.g. `summarization_fire` or `turn_cancelled`. */
  readonly type: string;
  /** The phase it fired in — "" when none applies; for a sub-agent's event, its master phase. */
  readonly phase: string;
  /** Type-specific fields, e.g. `{ before: 12000, after: 6100 }`. */
  readonly detail: Readonly<Record<string, string | number | boolean>>;
  /** EXACT prompt_eval_count the event carried, or null when it carried none — never a 0 stand-in. */
  readonly promptTokens: number | null;
  /** EXACT eval_count the event carried, or null when it carried none. */
  readonly evalTokens: number | null;
  /** Present only on a sub-agent's event (`subagent_id`). */
  readonly subagentId?: string;
}
