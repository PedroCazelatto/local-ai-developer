// Phase-instruction loader (V1/01). A phase IS an instruction set loaded into a context window
// (CLAUDE.md, "Core mental model"): this reads rules/phases/<phase>.md from the ORCHESTRATOR repo
// and hands back its full markdown to seed that phase's system message.
//
// Read FRESH on every activation (never cached at boot) so editing a phase markdown and re-swapping
// picks up the change without restarting `run start` — this is what lets V1/08 iterate on
// planning-phase content live. Missing/unreadable file → fail loud with a typed error naming the
// exact expected path, never a silent fall-back to a blank/generic prompt (a prompt-less phase is
// the bug this loader exists to prevent).

import { existsSync, readFileSync } from 'node:fs';

import { availablePhaseNames } from './available-phase-names.js';
import { PhasePromptError } from './phase-prompt.js';
import { phasePromptPath } from './phase-prompt-path.js';

/**
 * Read rules/phases/<phase>.md and return its full UTF-8 contents to use as the phase's system
 * message. Fresh read every call. On a missing file, throws a PhasePromptError naming the expected
 * `rules/phases/<phase>.md` path (plus the phases that DO exist) — surfaced at activation time, so
 * a renamed/absent phase file fails loudly instead of producing a blank-prompt turn.
 */
export function loadPhasePrompt(phaseName: string): string {
  const normalized = phaseName.trim().toLowerCase();
  // phasePromptPath holds the one phase-name → rules/phases/<name>.md convention.
  const file = phasePromptPath(normalized);
  if (!existsSync(file)) {
    throw new PhasePromptError(
      `Phase instruction file not found: rules/phases/${normalized}.md. ` +
        // availablePhaseNames re-reads the folder, so the message names what is really there now.
        `Available phases: ${availablePhaseNames().join(', ')}`,
    );
  }
  return readFileSync(file, 'utf-8');
}
