// Record a blocker the Reviewer raised (V3/02) — its "I cannot judge this: the task itself is
// ambiguous / under-specified / self-contradictory" signal.

import { appendJsonlLine } from './append-jsonl-line.js';
import { blockersFile } from './blockers-file.js';
import { readBlockerRows } from './read-blocker-rows.js';
import type { RaisedBlocker } from './types.js';

/**
 * Record a blocker the Reviewer raised: derive the per-task 1-based id `${taskId}#${n}` by replaying
 * how many `raised` rows this task already has, stamp UTC now, append the row, and return it. No
 * parallelism (CLAUDE.md), so the count-then-append is race-free.
 */
export function raiseBlocker(
  projectPath: string,
  input: { readonly taskId: string; readonly round: number; readonly question: string },
): RaisedBlocker {
  // readBlockerRows: every intact row in blockers.jsonl, torn lines skipped.
  const priorForTask = readBlockerRows(projectPath).filter(
    (row) => row.kind === 'raised' && row.taskId === input.taskId,
  ).length;
  const raised: RaisedBlocker = {
    id: `${input.taskId}#${priorForTask + 1}`,
    taskId: input.taskId,
    round: input.round,
    question: input.question,
    raisedAt: new Date().toISOString(),
  };
  // appendJsonlLine: creates the dir, appends ONE line, fsyncs before close.
  appendJsonlLine(blockersFile(projectPath), { kind: 'raised', ...raised });
  return raised;
}
