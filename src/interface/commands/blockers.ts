// /blockers — every open blocker, with the task id and the question that raised it, so `/answer` has
// something to read from instead of the user scrolling back through a batch that ran overnight.
//
// A pure read of blockers.jsonl. Open-vs-resolved is derived by REPLAY, exactly as the store derives
// it: a `raised` row whose id has no matching `resolved` row is open. Nothing here writes, and nothing
// here reaches the model — a blocker is the Reviewer's question TO the user, and answering it is the
// user's own act (/answer, which then spawns Retro).
//
// Each row ends with the exact `/answer` line to type. The whole point of the command is to close the
// distance between seeing a blocker and resolving it, and a task id is long enough that retyping it
// from memory is where the mistake happens.

import { readBlockerRows } from '../../core/session/index.js';
import type { BlockerRow, RaisedBlocker } from '../../core/session/index.js';
import { renderer } from '../../core/ui/renderer.js';
import { theme } from '../../core/ui/theme.js';
import type { Command } from '../command.type.js';
import { formatLocalStamp } from './format-local-stamp.js';
import { writeFittedLine } from './write-fitted-line.js';
import { writeWrappedLines } from './write-wrapped-lines.js';

/** The slice of the orchestrator /blockers needs — satisfied structurally by SessionOrchestrator. */
export interface BlockersOrchestrator {
  readonly projectPath: string;
}

/** Every raised blocker with no matching `resolved` row, oldest first (the order they were raised in). */
function openBlockers(rows: readonly BlockerRow[]): RaisedBlocker[] {
  const resolvedIds = new Set(rows.filter((row) => row.kind === 'resolved').map((row) => row.id));
  return rows.filter((row): row is { kind: 'raised' } & RaisedBlocker => row.kind === 'raised' && !resolvedIds.has(row.id));
}

function showBlockers(orch: BlockersOrchestrator): void {
  // readBlockerRows: every intact row of blockers.jsonl, or [] when the file was never written (no
  // blocker has ever been raised here) — the missing-file degrade is the empty case below.
  const rows = readBlockerRows(orch.projectPath);
  const open = openBlockers(rows);

  if (open.length === 0) {
    const answered = rows.filter((row) => row.kind === 'resolved').length;
    renderer.systemMessage(
      answered === 0
        ? 'No blockers have been raised in this project.'
        : `No open blockers — all ${answered} raised so far have been answered.`,
    );
    return;
  }

  writeFittedLine('', theme.meta);
  writeFittedLine(`Open blockers (${open.length}) — the loop is waiting on you:`, theme.strong);
  writeFittedLine('', theme.meta);
  for (const blocker of open) {
    // formatLocalStamp: the stored UTC stamp on the reader's own wall clock.
    writeFittedLine(`  ⛔ ${blocker.taskId}  ·  round ${blocker.round}  ·  ${formatLocalStamp(blocker.raisedAt)}`, theme.danger);
    // writeWrappedLines: the question WRAPS rather than being cut — it is the thing being answered,
    // and half a question is a question nobody can answer.
    writeWrappedLines(`Q: ${blocker.question}`, '     ', theme.meta);
    writeFittedLine(`     /answer ${blocker.taskId} <your answer>`, theme.meta);
    writeFittedLine('', theme.meta);
  }
  writeFittedLine('Answering re-queues the task and spawns Retro to patch the gap.', theme.meta);
  writeFittedLine('', theme.meta);
}

export const blockersCommand: Command = {
  name: 'blockers',
  group: 'execution',
  description: 'List the open blockers the Reviewer raised, each with the /answer line to resolve it',
  usage: '/blockers',
  run: (ctx) => showBlockers(ctx.orch),
};
