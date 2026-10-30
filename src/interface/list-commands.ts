// Every registered slash-command, for the auto-generated /help.
//
// Registration order is preserved because a Map iterates in insertion order and command-registry.ts
// builds it from one static array — so /help's grouping reflects the list, with nothing to keep in sync.
// The registry is read inside the function body for the cycle reason get-command.ts sets out in full.

import { commandRegistry } from './command-registry.js';
import type { Command } from './command.type.js';

/** Every registered command, in registration order, for the auto-generated `/help`. */
export function listCommands(): Command[] {
  return [...commandRegistry.values()];
}
