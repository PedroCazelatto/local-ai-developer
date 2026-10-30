// availablePhaseNames — the phases that actually exist, read from disk rather than from a list in
// code. rules/phases/ is the single source of the phase set (docs/rules-loading.md), so adding a
// markdown file is all it takes for /swap, the factory and the not-found messages to know about it.

import { readdirSync } from 'node:fs';
import path from 'node:path';

import { PHASES_DIR } from './phase-prompt.js';

/** Sorted basenames of the phase instruction files that currently exist on disk. */
export function availablePhaseNames(): string[] {
  return readdirSync(PHASES_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => path.basename(f, '.md'))
    .sort();
}
