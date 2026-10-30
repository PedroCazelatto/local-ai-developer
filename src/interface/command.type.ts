// The shape every slash-command is declared as — the widest piece of vocabulary in this directory, with
// seventeen importers and no owning function: get-command.ts returns one, list-commands.ts returns many,
// build-command-registry.ts indexes them, and sixteen command modules each declare one.

import type { CommandContext } from './command-context.type.js';
import type { CommandGroup } from './command-group.type.js';
import type { CompletionContext } from './completion-context.type.js';

/** A registered slash-command. `group`/`description`/`usage` feed `/help`; `run` does the work. */
export interface Command {
  /** The word after the slash, e.g. `models` for `/models`. Unique across the registry. */
  readonly name: string;
  /** Which `/help` bucket this command falls under. */
  readonly group: CommandGroup;
  /** One-line description for `/help`. */
  readonly description: string;
  /** Optional usage/syntax line for `/help`, e.g. `/models list | pull <name> | use <name>`. */
  readonly usage?: string;
  /**
   * Optional Tab-completion candidates for the argument at `ctx.args.length` — return EVERY valid word
   * for that position; complete-line.ts filters them against what's typed. Omit it for a command with no
   * completable args. MUST be synchronous and cheap: it runs on the keypress, and an await would blank
   * the pinned status rows (the full reasoning lives in complete-line.ts).
   */
  complete?(ctx: CompletionContext): string[];
  run(ctx: CommandContext): void | Promise<void>;
}
