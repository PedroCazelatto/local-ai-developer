// The rules/phases/ location and the typed failure for reading one — the vocabulary the three
// phase-prompt functions beside this file share (phase-prompt-path.ts, available-phase-names.ts,
// load-phase-prompt.ts). It holds NO function of its own: a constant and one error class, which is
// what lets it keep its name while the functions it used to carry moved out under the constitution's
// one-function-per-file rule.

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
