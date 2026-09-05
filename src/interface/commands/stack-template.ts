// The per-stack scaffold bodies /new-project writes: one docker-compose and one .gitignore. Kept as
// inline data (two stacks) rather than a copied templates dir — minimal, and the compose shape is
// small.
//
// StackTemplate and the TEMPLATES table both have exactly one reader, this function, so they ride with
// it rather than each becoming a module of its own.

import { runnerCompose } from './runner-compose.js'; // one networked, hardened `runner` service
import type { Stack } from './stack.type.js';

interface StackTemplate {
  /** docker-compose.yml body — one networked, hardened `runner` service. */
  readonly compose: string;
  /** .gitignore body — .orchestrator/ (session state) + stack-appropriate ignores. */
  readonly gitignore: string;
}

const TEMPLATES: Record<Stack, StackTemplate> = {
  node: {
    compose: runnerCompose('node:24-slim'),
    gitignore: '.orchestrator/\nnode_modules/\ndist/\n*.log\n',
  },
  python: {
    compose: runnerCompose('python:3.13-slim'),
    gitignore: '.orchestrator/\n__pycache__/\n.venv/\nvenv/\n*.pyc\n',
  },
};

/** The compose + .gitignore bodies for one stack. */
export function stackTemplate(stack: Stack): StackTemplate {
  return TEMPLATES[stack];
}
