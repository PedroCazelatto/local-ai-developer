// Command registry (V5/02). A STATIC list of the slash-commands that have been migrated off the REPL's
// hardcoded switch, mirroring the tool registry (tools/registry.ts): explicit imports the build checks,
// a duplicate-name guard that fails loud, and per-command `summary`/`usage` metadata that V5/03's
// auto-generated `/help` will read straight off `listCommands()`. New commands append to COMMANDS and
// are dispatched automatically; repl.ts consults `getCommand()` first and falls back to the switch for
// the commands not yet migrated (exit / run / answer / new-project / swap / clear / subagents / resume).

import type { Interface as ReadlineInterface } from 'node:readline/promises';

import { modelsCommand } from '../commands/models.js';
import type { ReplOrchestrator } from './repl.js';

/** Everything a command's run() receives — the session orchestrator, the REPL's readline, and the args. */
export interface CommandContext {
  /** The session orchestrator (the same object the REPL drives). */
  readonly orch: ReplOrchestrator;
  /** The REPL's own readline — reuse it for any sub-prompt (the REPL owns stdin; don't fight it). */
  readonly rl: ReadlineInterface;
  /** Tokens after the command word, whitespace-split — e.g. `['pull', 'qwen2.5-coder:3b']` for `/models pull …`. */
  readonly args: string[];
  /** The raw line minus the leading slash, for commands that need original spacing (kept for parity). */
  readonly raw: string;
}

/** A registered slash-command. `summary`/`usage` feed V5/03's `/help`; `run` does the work. */
export interface Command {
  /** The word after the slash, e.g. `models` for `/models`. Unique across the registry. */
  readonly name: string;
  /** One-line description for `/help`. */
  readonly summary: string;
  /** Optional usage/syntax line for `/help`, e.g. `/models list | pull <name> | use <name>`. */
  readonly usage?: string;
  run(ctx: CommandContext): void | Promise<void>;
}

// The static command list. New registry-backed commands append here.
const COMMANDS: readonly Command[] = [modelsCommand];

/** name → command, built once with a duplicate-name guard (a dup is a build-time mistake, fail loud). */
const REGISTRY: ReadonlyMap<string, Command> = buildRegistry(COMMANDS);

function buildRegistry(commands: readonly Command[]): Map<string, Command> {
  const map = new Map<string, Command>();
  for (const command of commands) {
    if (map.has(command.name)) {
      throw new Error(`Duplicate command name '/${command.name}' in the command registry.`);
    }
    map.set(command.name, command);
  }
  return map;
}

/** Look up a registered command by name; undefined if it hasn't been migrated (repl falls back to the switch). */
export function getCommand(name: string): Command | undefined {
  return REGISTRY.get(name);
}

/** Every registered command, for V5/03's auto-generated `/help`. */
export function listCommands(): Command[] {
  return [...REGISTRY.values()];
}
