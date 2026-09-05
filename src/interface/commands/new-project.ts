// /new-project <name> <stack> (V1/07) — a USER command (not a model tool; it never appears in
// toolDefinitions). Scaffolds projects/<name>/ with a networked+hardened `runner` compose, the
// .orchestrator/ skeleton (memory/ + inbox/ — inbox supersedes AGENT_NOTES.md), a PRODUCT_SPEC.md
// skeleton, a stack-appropriate .gitignore, and `git init`. Each project is its own git repo.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { renderer } from '../../core/ui/renderer.js';
import type { Command } from '../command-registry.js';
import {
  BACKLOG_README_SKELETON,
  isKnownStack,
  KNOWN_STACKS,
  PRODUCT_SPEC_SKELETON,
  readmePlaceholder,
  stackTemplate,
} from './project-templates.js';

export interface CommandOutcome {
  readonly ok: boolean;
  readonly message: string;
}

// Safe project directory name: no separators, no traversal, only these characters.
const SAFE_NAME = /^[a-zA-Z0-9._-]+$/;

/**
 * Scaffold a new project under `projectsRoot`. Validates the name + stack and refuses to touch an
 * existing directory. Pure filesystem + `git init`; independent of the active session (the user
 * restarts with `run start <name>` to work on it).
 */
function scaffoldProject(args: readonly string[], projectsRoot: string): CommandOutcome {
  const name = args[0];
  const stack = args[1];

  if (name === undefined || name === '' || stack === undefined || stack === '') {
    return { ok: false, message: `Usage: /new-project <name> <stack>. Stacks: ${KNOWN_STACKS.join(', ')}.` };
  }
  if (name === '.' || name === '..' || !SAFE_NAME.test(name)) {
    return { ok: false, message: `Invalid project name '${name}'. Use letters, digits, '.', '_', '-' only.` };
  }
  if (!isKnownStack(stack)) {
    return { ok: false, message: `Unknown stack '${stack}'. Known stacks: ${KNOWN_STACKS.join(', ')}.` };
  }

  const projectDir = path.join(projectsRoot, name);
  if (existsSync(projectDir)) {
    return { ok: false, message: `Project '${name}' already exists at projects/${name}/ — leaving it untouched.` };
  }

  const template = stackTemplate(stack);
  try {
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(path.join(projectDir, '.orchestrator', 'memory'), { recursive: true });
    mkdirSync(path.join(projectDir, '.orchestrator', 'inbox'), { recursive: true });
    // backlog/ is COMMITTED (not under .orchestrator/): the Breakdown phase fills this tree.
    mkdirSync(path.join(projectDir, 'backlog'), { recursive: true });
    writeFileSync(path.join(projectDir, 'backlog', 'README.md'), BACKLOG_README_SKELETON, 'utf-8');
    writeFileSync(path.join(projectDir, '.gitignore'), template.gitignore, 'utf-8');
    writeFileSync(path.join(projectDir, 'docker-compose.yml'), template.compose, 'utf-8');
    writeFileSync(path.join(projectDir, 'README.md'), readmePlaceholder(name, stack), 'utf-8');
    writeFileSync(path.join(projectDir, 'PRODUCT_SPEC.md'), PRODUCT_SPEC_SKELETON, 'utf-8');
  } catch (err) {
    return { ok: false, message: `Failed to scaffold '${name}': ${err instanceof Error ? err.message : String(err)}` };
  }

  // One-shot git bootstrap: init only, no commits/branches/remotes (those stay manual — CLAUDE.md).
  let gitNote = '';
  try {
    execFileSync('git', ['init', '-q'], { cwd: projectDir, stdio: 'ignore' });
  } catch (err) {
    gitNote = ` (git init failed: ${err instanceof Error ? err.message : String(err)})`;
  }

  return {
    ok: true,
    message: `Created projects/${name}/ (${stack}).${gitNote} Run \`run start ${name}\` to work on it.`,
  };
}

export const newProjectCommand: Command = {
  name: 'new-project',
  group: 'projects',
  description: 'Scaffold a new project on disk (the session stays on its project — restart to open the new one)',
  usage: '/new-project <name> <stack>',
  // Tab: the stack is arg 1 of `/new-project <name> <stack>`, offered from the same KNOWN_STACKS list
  // scaffoldProject validates against. Arg 0 is a free-text project name, so it has nothing to suggest.
  complete: (ctx) => (ctx.args.length === 1 ? [...KNOWN_STACKS] : []),
  run: (ctx) => {
    // The session stays locked to its current project; scaffold under the orchestrator's projects/ root.
    const projectsRoot = path.resolve(process.cwd(), 'projects');
    const outcome = scaffoldProject(ctx.args, projectsRoot);
    if (outcome.ok) {
      renderer.systemMessage(outcome.message);
    } else {
      renderer.errorLine(outcome.message);
    }
  },
};
