// PhaseFactory — discovers the phase instruction files under rules/phases/ and builds a Phase
// from one (ports agents/factory.py's AgentFactory). The markdown files are the single source of
// each phase's behavior; this just reads them.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Phase } from './phase.js';

// rules/phases/ sits at the repo root. This file is at <root>/src/phases/factory.ts (tsx) or
// <root>/dist/phases/factory.js (built) — both two dirs below root — so `../../rules/phases`
// from this file's directory resolves to the repo root in either run mode.
const PHASES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'rules', 'phases');

export class PhaseFactory {
  /** Sorted basenames of rules/phases/*.md (ports available_roles). */
  static availablePhases(): string[] {
    return readdirSync(PHASES_DIR)
      .filter((f) => f.endsWith('.md'))
      .map((f) => path.basename(f, '.md'))
      .sort();
  }

  /**
   * Load a phase by name. Normalizes to lowercase; throws a clear "Unknown phase: '<name>'.
   * Available: …" error if the file is missing (the REPL turns this into a recoverable /swap line).
   */
  static get(name: string): Phase {
    const normalized = name.trim().toLowerCase();
    const file = path.join(PHASES_DIR, `${normalized}.md`);
    if (!existsSync(file)) {
      throw new Error(`Unknown phase: '${name}'. Available: ${PhaseFactory.availablePhases().join(', ')}`);
    }
    return { name: normalized, instructions: readFileSync(file, 'utf-8'), tools: [] };
  }
}
