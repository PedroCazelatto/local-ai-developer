// Look up one registered slash-command by name.
//
// The read of `commandRegistry` happens INSIDE the function body, and that is load-bearing rather than
// stylistic: command-registry.ts imports all sixteen command modules, several of which reach back here
// through commands/help.ts, so this module is evaluated while that map is still in its temporal dead
// zone. A top-level read would throw `Cannot access 'commandRegistry' before initialization`; a
// call-time read is always safe, because nothing calls a command before the registry has been built.

import { commandRegistry } from './command-registry.js';
import type { Command } from './command.type.js';

/** Look up a registered command by name; undefined for an unknown command (the REPL prints a hint). */
export function getCommand(name: string): Command | undefined {
  return commandRegistry.get(name);
}
