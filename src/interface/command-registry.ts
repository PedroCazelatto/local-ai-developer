// The registered command set, indexed by name — the SINGLE source of truth for every user
// slash-command (V5/02, completed by V5/03's full migration). Like the tool registry
// (tools/registry.ts): explicit imports the build checks, a duplicate-name guard that fails loud, and
// per-command `group` + `description` (+ optional `usage`) metadata that the auto-generated `/help`
// (commands/help.ts) reads straight off `listCommands()` — so a new command shows up in `/help`,
// correctly grouped, the MOMENT it is added to COMMANDS below, with no hand-maintained list to drift.
//
// This file declares NO function. It is a VALUE module, the way core/llm/daemon.ts is: the
// one-function-per-file sweep moved `getCommand`, `listCommands` and the former `buildRegistry` into
// their own files, and what is left is the list and the map built from it. It survives for that reason
// alone, not as a re-export shell — it exports exactly one value and re-exports nothing.
//
// `COMMANDS` stays private because its single consumer is the map on the next line.

import { modelsCommand } from '../commands/models.js';
import { buildCommandRegistry } from './build-command-registry.js'; // indexes by name; throws on a duplicate
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
import type { Command } from './command.type.js';

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

/**
 * name → command, built once with a duplicate-name guard (a dup is a build-time mistake, fail loud).
 *
 * Read it from a FUNCTION BODY only. Half the modules above import back through commands/help.ts, so a
 * reader inside this module's own dependency subtree runs while this binding is still in its temporal
 * dead zone; a top-level `const x = commandRegistry` there throws. get-command.ts states it in full.
 */
export const commandRegistry: ReadonlyMap<string, Command> = buildCommandRegistry(COMMANDS);
