// /subagents (V5/01) — list the live sub-agents the session has spawned: short id, age, message
// count, and the EXACT cumulative token total (prompt + eval) so the user can see when one is getting
// expensive. A user command, never a model tool (the model spawns/asks/dismisses via its own tools) —
// hence it lives here in interface/commands/, not in src/tools/. Read-only: it only reports.
//
// This file is the ASSEMBLER: it composes the single-function modules beside it into the one command
// object the registry registers, and exports that object and nothing else. Its own body is one arrow —
// show-subagents.ts prints the listing over age-label.ts, msg-label.ts and token-label.ts, and over
// core/ui/write.ts for the raw row (the private `write` copy this file used to declare is gone).

import type { Command } from '../command.type.js';
import { showSubagents } from './show-subagents.js';

export const subagentsCommand: Command = {
  name: 'subagents',
  group: 'subagents',
  description: 'List the live sub-agents this session spawned (id, age, messages, exact tokens)',
  // showSubagents: one row per live sub-agent, or a plain line saying there are none.
  run: (ctx) => showSubagents(ctx.orch),
};
