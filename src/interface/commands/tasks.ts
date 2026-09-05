// /tasks — the backlog, from inside the app. The single most-missed view: the backlog is what the
// whole session is organized around, and until now reading it meant quitting the REPL and opening the
// files. A pure read of the tree the Breakdown phase wrote (readBacklog is synchronous), no model call
// and nothing persisted.
//
// A USER command, never a model tool: a phase is seeded with the one task it is working on, and
// handing a window the whole backlog would spend its num_ctx on the tasks it was deliberately not
// given (docs/mental-model.md).
//
// This file is the ASSEMBLER: it composes the single-function modules beside it into the one command
// object the registry registers, and exports that object and nothing else. Its own body is one arrow —
// show-tasks.ts reads the backlog and prints it, over render-task-tree.ts.

import type { Command } from '../command.type.js';
import { showTasks } from './show-tasks.js';

export const tasksCommand: Command = {
  name: 'tasks',
  group: 'execution',
  description: "The backlog as an epic/story tree — status, order, unmet deps, and what /run next picks",
  usage: '/tasks',
  // showTasks: the backlog as a tree, marking the task `/run next` would pick and restating it in a
  // footer, or one recoverable line when the backlog is missing or malformed.
  run: (ctx) => showTasks(ctx.orch),
};
