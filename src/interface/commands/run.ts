// /run <selector> (V1/10 trigger → V3/01 loop → V3/05 batch). Runs backlog tasks SEQUENTIALLY (no
// parallelism); each task goes through the bounded implement→test→review→fix loop (runTaskLoop): a
// PERSISTENT Worker window across up to 5 rounds, and a FRESH Reviewer each round which COMMITS the files
// it accepts (possibly only some of them), escalating after 5 without a pass. The user is pulled in only
// on an escalation or a blocker.
//
// Selector → dispatch:
//   - a single task (`next`, or one explicit id) runs one runTaskLoop directly (run-single-task.ts).
//   - a batch (`all`, or a comma list of 2+ ids) runs UNATTENDED via runBatch (V3/05): sequential,
//     queues escalations/blockers without aborting, prints + persists an end-of-batch summary.
// A non-passing single task stashes whatever is LEFT of its attempt (kept for a later /answer→Retro, or
// inspection) and leaves the tree clean — the Worker never reuses it; a fresh Worker redoes the task from
// scratch. Files a Reviewer accepted along the way are already committed and are not part of the stash.
//
// This file is the ASSEMBLER: it composes the single-function modules beside it into the one command
// object the registry registers, and exports that object and nothing else. Its own body is one arrow —
// run-with-stop-armed.ts brackets the run, over dispatch-run.ts, resolve-selector.ts,
// run-single-task.ts, run-task-and-report.ts, the two reporter builders, build-spec-slice.ts,
// render-task-outcome.ts and token-cost-line.ts. The private `messageOf` copy this file used to
// declare is gone (core/err-message.ts), and RunOrchestrator is its own type module because four of
// those functions take it co-equally.

import type { Command } from '../command.type.js';
import { completeRun } from './complete-run.js';
import { runWithStopArmed } from './run-with-stop-armed.js';

export const runCommand: Command = {
  name: 'run',
  group: 'execution',
  description: 'Run backlog tasks through the implement→test→review→fix loop (the Reviewer commits what it accepts)',
  usage: '/run [next | all | <task-id>[,<id>…]]',
  // completeRun: `next`, `all`, and every not-done task id — the same set `all` would sweep. It is
  // registered by NAME rather than wrapped in an arrow: the `run:` arrow below is already this file's
  // one declaration, and a second arrow here would be a second one.
  complete: completeRun,
  // runWithStopArmed: arms the `/stop` signal for exactly the length of the run, then dispatches.
  run: (ctx) => runWithStopArmed(ctx.args, ctx.orch),
};
