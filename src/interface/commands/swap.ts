// /swap <phase> — switch the active phase (each phase keeps its OWN isolated message history; no leak,
// no auto-clear — CLAUDE.md). Migrated off the REPL switch into the registry (V5/03). The persistent
// color-coded phase field on the status line reflects the change; Shift+Tab cycles between phases
// without typing the command at all.

import * as renderer from '../../core/ui/renderer.js';
import type { Command } from '../command-registry.js';

export const swapCommand: Command = {
  name: 'swap',
  group: 'session',
  description: 'Switch the active phase (each phase keeps its own isolated history)',
  usage: '/swap <phase>',
  run: (ctx) => {
    const target = ctx.args[0];
    if (target === undefined || target === '') {
      renderer.errorLine(`Usage: /swap <phase>. Available: ${ctx.orch.availablePhases().join(', ')}`);
      return;
    }
    try {
      // switchPhase throws a clear Error on an unknown phase; catch it into a recoverable line so the REPL survives.
      ctx.orch.switchPhase(target);
      renderer.systemMessage(`→ phase: ${ctx.orch.activePhase}`);
    } catch (err) {
      renderer.errorLine(err instanceof Error ? err.message : String(err));
    }
  },
};
