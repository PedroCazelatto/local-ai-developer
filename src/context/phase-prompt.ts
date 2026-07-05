// Phase-instruction loader (V1/01). A phase IS an instruction set loaded into a context window
// (CLAUDE.md, "Core mental model"): this reads rules/phases/<phase>.md from the ORCHESTRATOR repo
// and hands back its full markdown to seed that phase's system message.
//
// Read FRESH on every activation (never cached at boot) so editing a phase markdown and re-swapping
// picks up the change without restarting `run start` — this is what lets V1/08 iterate on
// planning-phase content live. Missing/unreadable file → fail loud with a typed error naming the
// exact expected path, never a silent fall-back to a blank/generic prompt (a prompt-less phase is
// the bug this loader exists to prevent).

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// rules/phases/ sits at the orchestrator repo root — resolved relative to THIS file, never to the
// active project (rules are global; projects are agnostic to the orchestrator — CLAUDE.md). This
// file is <root>/src/context/phase-prompt.ts (tsx) or <root>/dist/context/phase-prompt.js (built),
// both two dirs below root, so `../../rules/phases` resolves to the repo root in either run mode.
export const PHASES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'rules',
  'phases',
);

/** Typed failure so callers (boot vs. /swap) can distinguish a missing prompt from other errors. */
export class PhasePromptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PhasePromptError';
  }
}

/** Canonical lowercase phase id → absolute path of its instruction file. */
export function phasePromptPath(phaseName: string): string {
  return path.join(PHASES_DIR, `${phaseName.trim().toLowerCase()}.md`);
}

/** Sorted basenames of the phase instruction files that currently exist on disk. */
export function availablePhaseNames(): string[] {
  return readdirSync(PHASES_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => path.basename(f, '.md'))
    .sort();
}

/**
 * Read rules/phases/<phase>.md and return its full UTF-8 contents to use as the phase's system
 * message. Fresh read every call. On a missing file, throws a PhasePromptError naming the expected
 * `rules/phases/<phase>.md` path (plus the phases that DO exist) — surfaced at activation time, so
 * a renamed/absent phase file fails loudly instead of producing a blank-prompt turn.
 */
export function loadPhasePrompt(phaseName: string): string {
  const normalized = phaseName.trim().toLowerCase();
  const file = phasePromptPath(normalized);
  if (!existsSync(file)) {
    throw new PhasePromptError(
      `Phase instruction file not found: rules/phases/${normalized}.md. ` +
        `Available phases: ${availablePhaseNames().join(', ')}`,
    );
  }
  return readFileSync(file, 'utf-8');
}
