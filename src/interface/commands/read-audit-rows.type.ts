// Types for read-audit-rows.ts (constitution: types live in a sibling file, never inline).
//
// The audit log is written by core/session/audit.ts as one JSON object per line, carrying far more
// than a listing needs (the full argument object and a ~1 KB output preview). AuditRow is the SLICE
// the /audit listing shows — read it, never the whole row, so a listing of a thousand calls does not
// drag a megabyte of previews through the renderer.

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

/** Column widths the formatter pads to, so a block of rows lines up as a table. */
export interface AuditColumnWidths {
  /** Widest phase name in the rows being printed. */
  readonly phase: number;
  /** Widest tool name in the rows being printed. */
  readonly tool: number;
}

/**
 * The tail of the audit log, or the reason it could not be read. `ok: false` is the recoverable path
 * — a project that has never dispatched a tool has no file, which is a normal state to report in one
 * line, not an error to throw out of a command.
 */
export type AuditTail =
  | {
      readonly ok: true;
      /** The last N intact rows, OLDEST FIRST (the order the file holds them in). */
      readonly rows: readonly AuditRow[];
      /** Every intact row in the file, so a listing can say which slice of the whole it is showing. */
      readonly total: number;
      /** Lines that were not readable as a row (a torn last line at worst) — reported, never hidden. */
      readonly malformed: number;
    }
  | {
      readonly ok: false;
      /**
       * True when the log simply is not there — a project where no tool has run yet, which is a normal
       * state to state plainly. False when the file exists and could not be read, which is a fault and
       * is surfaced as one. The two must not print the same way.
       */
      readonly absent: boolean;
      readonly error: string;
    };
