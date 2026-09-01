// /swap <phase> — switch the active phase (each phase keeps its OWN isolated message history; no leak,
// no auto-clear — CLAUDE.md). Migrated off the REPL switch into the registry (V5/03). The persistent
// color-coded phase field on the status line reflects the change.
//
// This file is the ASSEMBLER: it composes the single-function module beside it into the one command
// object the registry registers, and exports that object and nothing else. It declares no function of
// its own — swap-phase.ts validates, switches and reports.

import type { Command } from '../command.type.js';
import { swapPhase } from './swap-phase.js';

export const swapCommand: Command = {
  name: 'swap',
  group: 'session',
  description: 'Switch the active phase (each phase keeps its own isolated history)',
  usage: '/swap <phase>',
  // Tab: the phase names — the same list switchPhase validates against. /swap takes exactly one arg, so
  // there is nothing to offer past it.
  complete: (ctx) => (ctx.args.length === 0 ? ctx.orch.availablePhases() : []),
  // swapPhase switches the active phase, turning an unknown name into one recoverable line. It is
  // registered by NAME rather than wrapped in an arrow: the `complete:` arrow above is already this
  // file's one declaration, and a second arrow here would be a second one.
  run: swapPhase,
};
