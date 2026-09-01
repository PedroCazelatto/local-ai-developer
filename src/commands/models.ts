// /models (V5/02) — the model picker: `list` (installed models, active one marked), `pull <name>`
// (streamed, Ctrl-C-abortable, BLOCKS until done), `use <name>` (switch the live session model,
// persisted to state.json). When `use` names a model that isn't pulled yet, it doesn't error — it
// offers to download it inline via a single-keypress y/n confirm (no Enter), pulls on `y`, then
// switches. A user command, never a model tool — the model never picks its own runtime, so this lives
// in src/commands/ and hangs off the command registry (V5/02), not src/tools/. All talk to the HOST
// Ollama daemon directly (Ollama runs on the host GPU, not the sandbox — CLAUDE.md); the session
// orchestrator only holds/applies the active model.
//
// This file is the ASSEMBLER: it composes the single-function modules beside it into the one command
// object the registry registers, and exports that object and nothing else. It declares no function of
// its own — run.ts dispatches, and list-/pull-/use-subcommand.ts do the work.

import type { Command } from '../interface/command.type.js';
import { run } from './run.js';

const USAGE = 'Usage: /models list | pull <name> | use <name>';

/** The subcommands run.ts dispatches on, offered as Tab candidates. Keep the two in step. */
const SUBCOMMANDS: readonly string[] = ['list', 'pull', 'use'];

export const modelsCommand = {
  name: 'models',
  group: 'models',
  description: 'List, pull, and switch the local Ollama model',
  usage: USAGE,
  // Tab: the subcommands only. Model NAMES are deliberately left uncompleted — listing them means an async
  // call to the Ollama daemon, and an async completer blanks the pinned rows (see complete-line.ts). `pull`
  // names aren't local anyway; they're arbitrary registry strings.
  complete: (ctx) => (ctx.args.length === 0 ? [...SUBCOMMANDS] : []),
  // run.ts dispatches `/models <sub>`, and reads this object's `usage` back — a cycle, which is why that
  // read happens inside its function body. It must also stay a `function` DECLARATION rather than a const
  // arrow: entering the graph at run.ts evaluates this file first, and only a hoisted declaration is bound
  // by then. Both directions were driven; the arrow form throws `Cannot access 'run' before initialization`.
  run,
} satisfies Command;
