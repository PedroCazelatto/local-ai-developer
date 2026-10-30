// phasePromptPath — where a phase's instruction file lives on disk. The one place the phase-name →
// filename convention is written down, so the loader that reads the file and the tools that read or
// edit it (read-phase-rule.ts, edit-phase-rule.ts) cannot disagree about it.

import path from 'node:path';

import { PHASES_DIR } from './phase-prompt.js';

/** Canonical lowercase phase id → absolute path of its instruction file. */
export function phasePromptPath(phaseName: string): string {
  return path.join(PHASES_DIR, `${phaseName.trim().toLowerCase()}.md`);
}
