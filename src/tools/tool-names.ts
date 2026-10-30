// Every registered tool name — what the dispatcher lists back when the model calls a tool that does
// not exist.
//
// `toolRegistry` is read inside the function body, for the reason get-tool.ts states in full: this
// directory sits in an import cycle with core/session, and a module-evaluation-time read of a value
// reached through one throws before it is initialised.

import { toolRegistry } from './registry.js';

/** Every registered tool name (used for the unknown-tool error's `available` list). */
export function toolNames(): string[] {
  return [...toolRegistry.keys()];
}
