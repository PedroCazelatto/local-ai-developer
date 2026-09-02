// The body of /audit: read the tail of the tool audit log and print it as a table, or say why it
// could not be read. Split out of audit.ts, which is now the assembler that registers it.
//
// Rows print OLDEST FIRST, which is both the file's own order and the useful one here: the last thing
// that happened ends up nearest the prompt, where the reader already is.

import { renderer } from '../../core/ui/renderer.js';
import { theme } from '../../core/ui/theme.js';
import { formatAuditRow } from './format-audit-row.js';
import { readAuditRows } from './read-audit-rows.js';
import { writeFittedLine } from './write-fitted-line.js';

/** The slice of the orchestrator /audit needs — satisfied structurally by SessionOrchestrator. */
export interface AuditOrchestrator {
  readonly projectPath: string;
}

/**
 * Rows a bare `/audit` prints. 20 matches DEFAULT_LOG_COUNT — what the model's own `git_inspect log`
 * treats as a useful recent slice — so the two "show me the recent history" numbers agree.
 */
const DEFAULT_ROWS = 20;

const USAGE = `Usage: /audit [<row count>] — the last ${DEFAULT_ROWS} calls when the count is left off`;

/** Print the last `args[0]` (default 20) tool calls, one fitted row each, oldest first. */
export function showAudit(args: readonly string[], orch: AuditOrchestrator): void {
  const asked = (args[0] ?? '').trim();
  let limit = DEFAULT_ROWS;
  if (asked !== '') {
    const count = Number(asked);
    if (!Number.isInteger(count) || count < 1) {
      renderer.errorLine(`'${asked}' is not a row count. ${USAGE}`);
      return;
    }
    // Deliberately NOT clamped: an unattended batch can make hundreds of calls, and the user asking
    // for all of them wants all of them — this is their own scrollback to scroll and copy from.
    limit = count;
  }

  // readAuditRows: the last `limit` intact rows of tool_audit.jsonl, oldest first, with the intact
  // total and the count of lines that would not parse.
  const tail = readAuditRows(orch.projectPath, limit);
  if (!tail.ok) {
    // A log that is simply not there yet is a plain statement of fact; one that exists and would not
    // read is a fault, and the two must not look the same.
    if (tail.absent) renderer.systemMessage(tail.error);
    else renderer.errorLine(tail.error);
    return;
  }
  if (tail.rows.length === 0) {
    renderer.systemMessage('The tool audit log is empty — no tool call has been recorded in this project yet.');
    return;
  }

  // Pad each column to the widest value actually being printed, so the block reads as a table.
  const widths = {
    phase: Math.max(...tail.rows.map((row) => row.phase.length)),
    tool: Math.max(...tail.rows.map((row) => row.tool.length)),
  };

  writeFittedLine('', theme.meta);
  writeFittedLine(`Tool calls — the last ${tail.rows.length} of ${tail.total}:`, theme.strong);
  writeFittedLine('', theme.meta);
  for (const row of tail.rows) {
    // formatAuditRow: `HH:mm:ss · phase · tool · exit · duration`, padded to the block's widths.
    // A failing exit is coloured, so a bad call is findable in a wall of rows without reading each one.
    writeFittedLine(formatAuditRow(row, widths), row.exitStatus === 0 ? theme.meta : theme.danger);
  }
  writeFittedLine('', theme.meta);
  if (tail.malformed > 0) {
    // Never silent: an audit view that drops rows without saying so is worse than no audit view.
    writeFittedLine(
      `${tail.malformed} line(s) in the log could not be read and were skipped (a torn write at worst).`,
      theme.danger,
    );
    writeFittedLine('', theme.meta);
  }
}
