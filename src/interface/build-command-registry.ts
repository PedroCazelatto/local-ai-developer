// Index the static command list by name, failing loud on a duplicate.
//
// It was `buildRegistry` while it was private to command-registry.ts, and src/tools/registry.ts:85
// holds a DIFFERENT function of that same name — it indexes ToolModules, not Commands. Wave D will
// extract that one, and two `build-registry.ts` files with different bodies is exactly the collision the
// grep-before-you-name rule exists to prevent, so this one is qualified now rather than later.

import type { Command } from './command.type.js';

/** name → command, with a duplicate-name guard (a dup is a build-time mistake, so fail loud). */
export function buildCommandRegistry(commands: readonly Command[]): Map<string, Command> {
  const map = new Map<string, Command>();
  for (const command of commands) {
    if (map.has(command.name)) {
      throw new Error(`Duplicate command name '/${command.name}' in the command registry.`);
    }
    map.set(command.name, command);
  }
  return map;
}
