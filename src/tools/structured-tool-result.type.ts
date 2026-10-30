// The structured half of a tool result. Folder vocabulary: every tool may return one and the
// dispatcher reads every field of it, so no single function owns the shape — not even tool-error.ts,
// which builds one particular instance of it.

import type { ToolCallDisplay } from '../core/ui/tool-call-display.type.js';
import type { JsonObject } from './json-object.type.js';
import type { ToolAuditExtra } from './tool-audit-extra.type.js';

/**
 * A structured tool result. `content` is what the model sees as the `tool` message — a string is
 * used verbatim, an object is JSON-stringified (V1/02). `exitStatus` / `error` feed the audit row
 * (V1/06): file tools omit them (0 / null derived), while execute_command / run_in_project set the
 * REAL shell/container exit code so the audit records it, not a flattened 0.
 */
export interface StructuredToolResult {
  readonly content: string | JsonObject;
  readonly exitStatus?: number;
  readonly error?: string | null;
  /** Tool-specific fields recorded on the audit row (e.g. execute_command's resolved workdir). */
  readonly metadata?: JsonObject;
  /**
   * What the SCROLLBACK should say about this call — the `←` result line, and the diff when the call
   * changed a file. Never written to the audit log (appendAuditRow builds its row from an explicit
   * field list), so a diff body cannot bloat tool_audit.jsonl. It rides out on the result because the
   * dispatch choke point cannot derive it: only this tool held the file's bytes before and after, or
   * knows how many matches it stopped counting at. A tool that omits it still gets a result line.
   */
  readonly display?: ToolCallDisplay;
  /**
   * Extra audit rows for internal sub-steps of one tool call — e.g. run_in_project's auto-build,
   * which is logged as its own row BEFORE the run row (V1/05/06). The dispatcher writes these; the
   * tool never touches the audit log directly.
   */
  readonly auditExtras?: readonly ToolAuditExtra[];
}
