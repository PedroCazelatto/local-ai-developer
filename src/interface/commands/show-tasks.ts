// The body of /tasks: read the backlog and print it as an epic/story tree. Split out of tasks.ts,
// which is now the assembler that registers it.
//
// It renders a TREE rather than the flat ordered list `/run` selects from — the user's decision: the
// tree is how Breakdown actually writes the backlog. Every row still carries what the flat list would
// have shown, including the one `/run next` would pick, which is also restated in the footer so a
// narrow terminal cutting a row can never hide the answer.

import { BacklogError } from '../../core/session/backlog-error.js';
import { nextRunnableTasks } from '../../core/session/next-runnable-tasks.js';
import { readBacklog } from '../../core/session/read-backlog.js';
import type { Backlog } from '../../core/session/backlog.type.js';
import { renderer } from '../../core/ui/renderer.js';
import { theme } from '../../core/ui/theme.js';
import { renderTaskTree } from './render-task-tree.js';
import { writeFittedLine } from './write-fitted-line.js';

/** The slice of the orchestrator /tasks needs — satisfied structurally by SessionOrchestrator. */
export interface TasksOrchestrator {
  readonly projectPath: string;
}

/** Print the backlog as a tree, marking what `/run next` would pick and restating it in the footer. */
export function showTasks(orch: TasksOrchestrator): void {
  let backlog: Backlog;
  try {
    // readBacklog: read + validate the whole backlog/ tree; throws BacklogError when it is missing or
    // a task's frontmatter is malformed.
    backlog = readBacklog(orch.projectPath);
  } catch (err) {
    // The same recoverable degrade /run does: one line naming what is wrong, never a thrown command.
    renderer.errorLine(err instanceof BacklogError ? err.message : String(err));
    return;
  }

  // nextRunnableTasks: pending tasks whose every dependency is done, in `order` — its head is exactly
  // what `/run next` would select, so the tree's mark and the command agree by construction.
  const next = nextRunnableTasks(backlog)[0]?.id ?? null;

  writeFittedLine('', theme.meta);
  // renderTaskTree: the backlog as a compact epic/story tree — status, order, unmet deps, next pick.
  for (const row of renderTaskTree(backlog, next)) writeFittedLine(row.text, row.style);
  writeFittedLine('', theme.meta);
  writeFittedLine(
    next === null
      ? 'Nothing is runnable right now — every task is done, blocked, or waiting on an unmet dependency.'
      : `Next: /run next → ${next}`,
    theme.meta,
  );
  writeFittedLine('', theme.meta);
}
