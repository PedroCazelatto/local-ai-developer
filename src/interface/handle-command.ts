// The `/command` half of one line of input: look the word up in the registry and run it.

import type { Interface as ReadlineInterface } from 'node:readline/promises';

import { renderer } from '../core/ui/renderer.js';
import { getCommand } from './get-command.js'; // name -> Command, undefined for an unknown one
import type { ReplOrchestrator } from './run-repl.js';

/**
 * Dispatch a `/command` through the registry (every command lives there now — V5/03). Unknown commands
 * get a recoverable hint. Returns true only when a command requested exit (`/exit`), signalling the loop
 * to stop; every other command returns false.
 */
export async function handleCommand(orch: ReplOrchestrator, input: string, rl: ReadlineInterface): Promise<boolean> {
  const withoutSlash = input.slice(1);
  const [command, ...rest] = withoutSlash.split(/\s+/);

  const registered = getCommand(command ?? '');
  if (registered === undefined) {
    renderer.errorLine(`Unknown command: /${command ?? ''}. Type /help for the list.`);
    return false;
  }

  let exitRequested = false;
  await registered.run({
    orch,
    rl,
    args: rest,
    raw: withoutSlash,
    requestExit: () => {
      exitRequested = true;
    },
  });
  return exitRequested;
}
