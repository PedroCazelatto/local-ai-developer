// /exit — quit the session. Migrated off the REPL switch into the registry (V5/03). The REPL owns its
// loop, so this can't return-to-break like the old switch did; instead it calls ctx.requestExit(),
// which trips the flag the REPL checks after dispatch to stop reading input.

import type { Command } from '../command-registry.js';

export const exitCommand: Command = {
  name: 'exit',
  group: 'session',
  description: 'Quit the session',
  run: (ctx) => {
    ctx.requestExit();
  },
};
