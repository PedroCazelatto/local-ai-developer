// Command registry — the SINGLE source of truth for every user slash-command (V5/02, completed by
// V5/03's full migration). Like the tool registry (tools/registry.ts): explicit imports the build
// checks, a duplicate-name guard that fails loud, and per-command `group` + `description` (+ optional
// `usage`) metadata that the auto-generated `/help` (commands/help.ts) reads straight off
// `listCommands()` — so a new command shows up in `/help`, correctly grouped, the MOMENT it is added
// to COMMANDS below, with no hand-maintained list to drift.
//
// The REPL dispatches EVERY command through `getCommand` (handle-command.ts) — the old fallback switch
// is gone. A command that needs to stop the session (`/exit`) calls `ctx.requestExit()`; the loop in
// run-repl.ts owns the decision.

import type { Interface as ReadlineInterface } from 'node:readline/promises';

import { modelsCommand } from '../commands/models.js';
import { answerCommand } from './commands/answer.js';
import { auditCommand } from './commands/audit.js';
import { batchCommand } from './commands/batch.js';
import { blockersCommand } from './commands/blockers.js';
import { clearCommand } from './commands/clear.js';
import { exitCommand } from './commands/exit.js';
import { helpCommand } from './commands/help.js';
import { inboxCommand } from './commands/inbox.js';
import { newProjectCommand } from './commands/new-project.js';
import { questionsCommand } from './commands/questions.js';
import { resumeCommand } from './commands/resume.js';
import { runCommand } from './commands/run.js';
import { subagentsCommand } from './commands/subagents.js';
import { swapCommand } from './commands/swap.js';
import { tasksCommand } from './commands/tasks.js';
import type { ReplOrchestrator } from './run-repl.js';

/** The purpose buckets `/help` groups commands under. The display order/labels live in commands/help.ts. */
export type CommandGroup = 'session' | 'models' | 'projects' | 'subagents' | 'execution';

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

/** What a command's `complete()` receives to offer Tab candidates for the argument being typed. */
export interface CompletionContext {
  /** The session orchestrator — the source of live candidates (phases, the project path for the backlog). */
  readonly orch: ReplOrchestrator;
  /** The SETTLED args before the word being typed — `['use']` when the cursor sits in `/models use qw⎸`. */
  readonly args: string[];
}

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

// The static command list — the ONE place a command is registered. New commands append here.
const COMMANDS: readonly Command[] = [
  helpCommand,
  swapCommand,
  clearCommand,
  resumeCommand,
  exitCommand,
  modelsCommand,
  newProjectCommand,
  subagentsCommand,
  runCommand,
  answerCommand,
  questionsCommand,
  // The inspection commands (backlog/inspection-commands.md) — pure reads over what the session has
  // already written under .orchestrator/, so the walk-away loop has a come-back half.
  tasksCommand,
  blockersCommand,
  inboxCommand,
  batchCommand,
  auditCommand,
];

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

/** Look up a registered command by name; undefined for an unknown command (the REPL prints a hint). */
export function getCommand(name: string): Command | undefined {
  return REGISTRY.get(name);
}

/** Every registered command, in registration order, for the auto-generated `/help`. */
export function listCommands(): Command[] {
  return [...REGISTRY.values()];
}
