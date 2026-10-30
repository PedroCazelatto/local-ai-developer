// The body of /blockers: print every open blocker with the exact `/answer` line that resolves it.
// Split out of blockers.ts, which is now the assembler that registers it.
//
// Each row ends with the `/answer` line to type. The whole point of the command is to close the
// distance between seeing a blocker and resolving it, and a task id is long enough that retyping it
// from memory is where the mistake happens.

import { readBlockerRows } from '../../core/session/read-blocker-rows.js';
import { renderer } from '../../core/ui/renderer.js';
import { theme } from '../../core/ui/theme.js';
import { formatLocalStamp } from './format-local-stamp.js';
import { openBlockers } from './open-blockers.js';
import { writeFittedLine } from './write-fitted-line.js';
import { writeWrappedLines } from './write-wrapped-lines.js';

/** The slice of the orchestrator /blockers needs — satisfied structurally by SessionOrchestrator. */
export interface BlockersOrchestrator {
  readonly projectPath: string;
}

/** Print the open blockers, or say plainly that there are none (and how many were answered). */
export function showBlockers(orch: BlockersOrchestrator): void {
  // readBlockerRows: every intact row of blockers.jsonl, or [] when the file was never written (no
  // blocker has ever been raised here) — the missing-file degrade is the empty case below.
  const rows = readBlockerRows(orch.projectPath);
  // openBlockers: replay the rows and keep the `raised` ones nothing has resolved yet.
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
