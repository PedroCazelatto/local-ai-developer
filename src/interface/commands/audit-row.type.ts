// One tool call as the /audit listing sees it.
//
// The audit log is written by core/session/audit.ts as one JSON object per line, carrying far more
// than a listing needs (the full argument object and a ~1 KB output preview). AuditRow is the SLICE
// the /audit listing shows — read it, never the whole row, so a listing of a thousand calls does not
// drag a megabyte of previews through the renderer.
//
// Owned by no function: to-audit-row.ts narrows one, read-audit-rows.ts collects them into its tail,
// and format-audit-row.ts prints one. It is the /audit view's vocabulary, so it gets its own file.

/** One tool call as the /audit listing sees it — the fields of a `tool_audit.jsonl` row it prints. */
export interface AuditRow {
  /** UTC ISO-8601 ms, when the call was dispatched (`ts` on the file's row). */
  readonly ts: string;
  /** The phase whose window made the call (`phase` — never the legacy `persona`). */
  readonly phase: string;
  /** The tool's registry name, e.g. `read_file`. */
  readonly tool: string;
  /**
   * `exit_status`: 0, a real exit code, or -1 for any failure. Null ONLY when the row carried no
   * usable value — surfaced as unknown by the formatter rather than shown as a 0 that would read as
   * a success that was never reported (constitution: an absent value is surfaced, never guessed).
   */
  readonly exitStatus: number | null;
  /** `duration_ms` — how long the call took. Null when the row carried no usable value. */
  readonly durationMs: number | null;
  /** Present only on a sub-agent's own call (`subagent_id`); a master-phase call omits the field. */
  readonly subagentId?: string;
}
