// /new-project <name> <stack> (V1/07) — a USER command (not a model tool; it never appears in
// toolDefinitions). Scaffolds projects/<name>/ with a networked+hardened `runner` compose, the
// .orchestrator/ skeleton (memory/ + inbox/ — inbox supersedes AGENT_NOTES.md), a PRODUCT_SPEC.md
// skeleton, a stack-appropriate .gitignore, and `git init`. Each project is its own git repo.
//
// This file is the ASSEMBLER: it composes the single-function modules beside it into the one command
// object the registry registers, and exports that object and nothing else. It declares no function of
// its own — run-new-project.ts reports, scaffold-project.ts does the work, and the per-stack bodies
// live in stack-template.ts and the skeleton files beside it.

import type { Command } from '../command.type.js';
import { KNOWN_STACKS } from './known-stacks.js';
import { runNewProject } from './run-new-project.js';

export const newProjectCommand: Command = {
  name: 'new-project',
  group: 'projects',
  description: 'Scaffold a new project on disk (the session stays on its project — restart to open the new one)',
  usage: '/new-project <name> <stack>',
  // Tab: the stack is arg 1 of `/new-project <name> <stack>`, offered from the same KNOWN_STACKS list
  // scaffoldProject validates against. Arg 0 is a free-text project name, so it has nothing to suggest.
  complete: (ctx) => (ctx.args.length === 1 ? [...KNOWN_STACKS] : []),
  // runNewProject resolves the projects/ root, scaffolds, and reports the outcome in one line. It is
  // registered by NAME rather than wrapped in an arrow: the `complete:` arrow above is already this
  // file's one declaration, and a second arrow here would be a second one.
  run: runNewProject,
};
