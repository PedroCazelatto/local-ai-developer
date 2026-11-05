// The body of /events: the last N harness events as a padded table — the compactions, evictions,
// cancelled turns, debates and model switches that explain what a run did between its tool calls.
// The events twin of show-audit.ts, and deliberately the same in every rule: a bad count is one
// recoverable line, an absent log is a plain fact, an unreadable one is a fault, and a row that would
// not read is reported rather than dropped.

import { renderer } from '../../core/ui/renderer.js';
import { theme } from '../../core/ui/theme.js';
import { eventsLogFile } from './events-log-file.js'; // the pre-memory.db events.jsonl
import { formatEventRow } from './format-event-row.js';
import { legacyLogNote } from './legacy-log-note.js';
import { readEventRows } from './read-event-rows.js';
import { writeFittedLine } from './write-fitted-line.js';

/** The slice of the orchestrator /events needs — satisfied structurally by SessionOrchestrator. */
export interface EventsOrchestrator {
  readonly projectPath: string;
}

/** Rows a bare `/events` prints — the same 20 as `/audit`, so the two "recent history" views agree. */
const DEFAULT_ROWS = 20;

const USAGE = `Usage: /events [<row count>] — the last ${DEFAULT_ROWS} events when the count is left off`;

/** Print the last `args[0]` (default 20) harness events, one fitted row each, oldest first. */
export function showEvents(args: readonly string[], orch: EventsOrchestrator): void {
  const asked = (args[0] ?? '').trim();
  let limit = DEFAULT_ROWS;
  if (asked !== '') {
    const count = Number(asked);
    if (!Number.isInteger(count) || count < 1) {
      renderer.errorLine(`'${asked}' is not a row count. ${USAGE}`);
      return;
    }
    // Not clamped, as with /audit: the user asking for every event of an overnight batch wants them all.
    limit = count;
  }

  // readEventRows: the last `limit` rows of memory.db's events table, oldest first, with the table's
  // total and the count of rows that would not narrow.
  const tail = readEventRows(orch.projectPath, limit);
  // legacyLogNote: where the pre-memory.db events are, while the table has nothing to show.
  const legacy = legacyLogNote(eventsLogFile(orch.projectPath));
  if (!tail.ok) {
    if (tail.absent) renderer.systemMessage(tail.error);
    else renderer.errorLine(tail.error);
    if (tail.absent && legacy !== null) renderer.systemMessage(legacy);
    return;
  }
  if (tail.rows.length === 0 && tail.malformed === 0) {
    renderer.systemMessage('The events log is empty — no harness event has been recorded in this project yet.');
    if (legacy !== null) renderer.systemMessage(legacy);
    return;
  }

  // Pad each column to the widest value actually being printed, so the block reads as a table. An
  // event outside any phase prints `-` in that column, so it counts for at least one character.
  const widths = {
    phase: Math.max(1, ...tail.rows.map((row) => row.phase.length)),
    type: Math.max(...tail.rows.map((row) => row.type.length)),
  };

  writeFittedLine('', theme.meta);
  writeFittedLine(`Harness events — the last ${tail.rows.length} of ${tail.total}:`, theme.strong);
  writeFittedLine('', theme.meta);
  for (const row of tail.rows) {
    // formatEventRow: `HH:mm:ss · phase · type · key=value … · tokens`, padded to the block's widths.
    writeFittedLine(formatEventRow(row, widths), theme.meta);
  }
  writeFittedLine('', theme.meta);
  if (tail.malformed > 0) {
    // Never silent, for the reason /audit gives: a view that drops rows without saying so is worse than none.
    writeFittedLine(`${tail.malformed} row(s) in the log could not be read and were skipped.`, theme.danger);
    writeFittedLine('', theme.meta);
  }
}
