// /tasks — the backlog, from inside the app. The single most-missed view: the backlog is what the
// whole session is organized around, and until now reading it meant quitting the REPL and opening the
// files. A pure read of the tree the Breakdown phase wrote (readBacklog is synchronous), no model call
// and nothing persisted.
//
// A USER command, never a model tool: a phase is seeded with the one task it is working on, and
// handing a window the whole backlog would spend its num_ctx on the tasks it was deliberately not
// given (docs/mental-model.md).
//
// It renders an epic/story TREE rather than the flat ordered list `/run` selects from — the user's
// decision: the tree is how Breakdown actually writes the backlog. Every row still carries what the
// flat list would have shown, including the one `/run next` would pick, which is also restated in the
// footer so a narrow terminal cutting a row can never hide the answer.

import { BacklogError, nextRunnableTasks, readBacklog } from '../../core/session/index.js';
import type { Backlog } from '../../core/session/index.js';
import { renderer } from '../../core/ui/renderer.js';
import { theme } from '../../core/ui/theme.js';
import type { Command } from '../command-registry.js';
import { renderTaskTree } from './render-task-tree.js';
import { writeFittedLine } from './write-fitted-line.js';

/** The slice of the orchestrator /tasks needs — satisfied structurally by SessionOrchestrator. */
export interface TasksOrchestrator {
  readonly projectPath: string;
}

function showTasks(orch: TasksOrchestrator): void {
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

export const tasksCommand: Command = {
  name: 'tasks',
  group: 'execution',
  description: "The backlog as an epic/story tree — status, order, unmet deps, and what /run next picks",
  usage: '/tasks',
  run: (ctx) => showTasks(ctx.orch),
};
