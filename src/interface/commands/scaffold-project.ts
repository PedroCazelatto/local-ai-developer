// Scaffold projects/<name>/ on disk for /new-project (V1/07): a networked+hardened `runner` compose,
// the .orchestrator/ skeleton (memory/ + inbox/ — inbox supersedes AGENT_NOTES.md), a committed
// backlog/ seed, a PRODUCT_SPEC.md skeleton, a stack-appropriate .gitignore, and `git init`. Each
// project is its own git repo.
//
// Pure filesystem + `git init`, and it prints nothing: it returns an outcome and run-new-project.ts
// decides whether that becomes a system line or an error line. That is what keeps the scaffold
// callable — and checkable — without a terminal.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { errMessage } from '../../core/err-message.js'; // an Error's message, or the thrown value stringified
import { BACKLOG_README_SKELETON } from './backlog-readme-skeleton.js';
import { isKnownStack } from './is-known-stack.js'; // narrow the raw argument onto the Stack union
import { KNOWN_STACKS } from './known-stacks.js';
import { PRODUCT_SPEC_SKELETON } from './product-spec-skeleton.js';
import { readmePlaceholder } from './readme-placeholder.js'; // the project's first README body
import { stackTemplate } from './stack-template.js'; // the stack's compose + .gitignore bodies

/** What a scaffold attempt reports back: whether it happened, and the one line to show the user. */
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
export function scaffoldProject(args: readonly string[], projectsRoot: string): CommandOutcome {
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
    return { ok: false, message: `Failed to scaffold '${name}': ${errMessage(err)}` };
  }

  // One-shot git bootstrap: init only, no commits/branches/remotes (those stay manual — CLAUDE.md).
  let gitNote = '';
  try {
    execFileSync('git', ['init', '-q'], { cwd: projectDir, stdio: 'ignore' });
  } catch (err) {
    gitNote = ` (git init failed: ${errMessage(err)})`;
  }

  return {
    ok: true,
    message: `Created projects/${name}/ (${stack}).${gitNote} Run \`run start ${name}\` to work on it.`,
  };
}
