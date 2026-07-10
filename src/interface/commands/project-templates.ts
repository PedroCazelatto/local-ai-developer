// Per-stack scaffold templates for /new-project (V1/07). Kept as inline data (two stacks) rather
// than a copied templates dir — minimal, and the compose shape is small. Add stacks ON DEMAND, not
// preemptively (CLAUDE.md): only `node` and `python` to start.
//
// The `runner` service is NETWORKED + hardened (the pivot reverses the old network_mode:none):
// rootless user + CPU/RAM caps, network ON so run_in_project's `npm i` / `pip install` work. The
// service name is exactly `runner` — run_in_project (V1/05) targets it by that name.

export type Stack = 'node' | 'python';

export const KNOWN_STACKS: readonly Stack[] = ['node', 'python'];

export function isKnownStack(value: string): value is Stack {
  return (KNOWN_STACKS as readonly string[]).includes(value);
}

interface StackTemplate {
  /** docker-compose.yml body — one networked, hardened `runner` service. */
  readonly compose: string;
  /** .gitignore body — .orchestrator/ (session state) + stack-appropriate ignores. */
  readonly gitignore: string;
}

/** node:22-slim / python:3.13-slim runner. Do NOT set network_mode: none — installs need the net. */
function runnerCompose(image: string): string {
  return `services:
  runner:
    image: ${image}
    working_dir: /workspace
    volumes:
      - .:/workspace
    # Rootless: the model's toolchain runs as a non-root uid, never root.
    user: "1000:1000"
    # Hardened caps (a 3060 box; CPU-bound container work). Keep modest.
    mem_limit: 2g
    cpus: 2.0
    # Network stays ON (compose default) so run_in_project can install deps. Do not disable it.
`;
}

const TEMPLATES: Record<Stack, StackTemplate> = {
  node: {
    compose: runnerCompose('node:22-slim'),
    gitignore: '.orchestrator/\nnode_modules/\ndist/\n*.log\n',
  },
  python: {
    compose: runnerCompose('python:3.13-slim'),
    gitignore: '.orchestrator/\n__pycache__/\n.venv/\nvenv/\n*.pyc\n',
  },
};

export function stackTemplate(stack: Stack): StackTemplate {
  return TEMPLATES[stack];
}

/** The committed narrative doc the planning phases fill in. Section names match V1/08's writers. */
export const PRODUCT_SPEC_SKELETON = `# Product Spec

## Vision

## Domain Glossary

## Epics

## Stories

## Architecture

## Execution Sequence
`;

/** Seed doc at backlog/README.md explaining the .md-tree format the Breakdown phase fills in. */
export const BACKLOG_README_SKELETON = `# Backlog

The ordered Task list the execution loop consumes, as a tree of Markdown files (up to three
levels). **Only task files are required** — a task may sit directly here, or under an epic, or
under an epic + story:

\`\`\`
backlog/
  epic-<slug>/          # optional epic folder
    README.md           # epic level documentation (this same shape)
    story-<slug>/       # optional story folder
      README.md         # story level documentation
      01-<slug>.md      # a TASK (required leaf)
  02-<slug>.md          # a task with no epic/story is allowed
\`\`\`

A file named \`README.md\` documents its level and is never a task. Every other \`.md\` is a task
whose **id is its path under \`backlog/\` without \`.md\`** (e.g. \`epic-auth/story-signup/01-add-test\`).

Each task file carries YAML frontmatter + a Markdown body:

\`\`\`markdown
---
status: pending          # pending | in_progress | done | blocked
order: 1                 # global execution sequence (integer)
depends_on: []           # task ids that must be done first, e.g. [epic-auth/story-signup/00-scaffold]
---
# Short task title

What to build, plus any constraints.

## Acceptance
The observable signal of done (e.g. "npm test passes the hashing spec").
\`\`\`
`;

export function readmePlaceholder(name: string, stack: Stack): string {
  return `# ${name}

A ${stack} project scaffolded by Local AI Developer. Planning and execution artifacts live under
\`.orchestrator/\` (git-ignored); the committed narrative is \`PRODUCT_SPEC.md\`.
`;
}
