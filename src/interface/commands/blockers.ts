// /blockers — every open blocker, with the task id and the question that raised it, so `/answer` has
// something to read from instead of the user scrolling back through a batch that ran overnight.
//
// A pure read of blockers.jsonl. Open-vs-resolved is derived by REPLAY, exactly as the store derives
// it: a `raised` row whose id has no matching `resolved` row is open. Nothing here writes, and nothing
// here reaches the model — a blocker is the Reviewer's question TO the user, and answering it is the
// user's own act (/answer, which then spawns Retro).
//
// This file is the ASSEMBLER: it composes the single-function modules beside it into the one command
// object the registry registers, and exports that object and nothing else. Its own body is one arrow —
// show-blockers.ts prints the listing over open-blockers.ts, which does the replay.

import type { Command } from '../command.type.js';
import { showBlockers } from './show-blockers.js';

export const blockersCommand: Command = {
  name: 'blockers',
  group: 'execution',
  description: 'List the open blockers the Reviewer raised, each with the /answer line to resolve it',
  usage: '/blockers',
  // showBlockers: the unresolved `raised` rows, oldest first, each with its question wrapped in full
  // and the exact /answer line to type; an empty set says so and names how many were answered.
  run: (ctx) => showBlockers(ctx.orch),
};
