// What a command's run() receives. Owned by no function — no declaration in this directory produces
// one; the REPL's handle-command.ts builds the object inline and all five of src/commands/'s
// sub-command handlers consume it — so it is the folder's vocabulary and gets its own file.

import type { Interface as ReadlineInterface } from 'node:readline/promises';

import type { ReplOrchestrator } from './run-repl.js';

/** Everything a command's run() receives — the session orchestrator, the REPL's readline, and the args. */
export interface CommandContext {
  /** The session orchestrator (the same object the REPL drives). */
  readonly orch: ReplOrchestrator;
  /** The REPL's own readline — reuse it for any sub-prompt (the REPL owns stdin; don't fight it). */
  readonly rl: ReadlineInterface;
  /** Tokens after the command word, whitespace-split — e.g. `['pull', 'qwen2.5-coder:3b']` for `/models pull …`. */
  readonly args: string[];
  /** The raw line minus the leading slash, for commands that need original spacing (e.g. `/answer`). */
  readonly raw: string;
  /** `/exit` calls this to signal the REPL loop to stop; every other command leaves it untouched. */
  requestExit(): void;
}
