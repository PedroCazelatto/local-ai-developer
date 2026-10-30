// /clear — start the active phase on a NEW context, no confirmation (the user owns the decision to
// clear — CLAUDE.md). Nothing is destroyed: the context it sets aside keeps every turn it held and
// stays reopenable with /resume, so this command reports the address that would bring it back. Other
// phases are untouched. A user command, never a model tool — hence interface/commands/, not src/tools/.
//
// This file is the ASSEMBLER: it composes the single-function module beside it into the one command
// object the registry registers, and exports that object and nothing else. Its own body is one arrow —
// clear-phase.ts switches the context and reports it, over core/ui/capitalize-phase.ts for the
// display name (the private `titleCase` copy this file used to declare is gone).

import type { Command } from '../command.type.js';
import { clearPhase } from './clear-phase.js';

export const clearCommand: Command = {
  name: 'clear',
  group: 'session',
  description: "Start the active phase on a new context (the old one stays — /resume reopens it)",
  // clearPhase: points the phase at a fresh context and reports the /resume address of the one set
  // aside, or says plainly that there was nothing to set aside.
  run: (ctx) => clearPhase(ctx.orch),
};
