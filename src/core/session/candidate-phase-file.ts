// The absolute rules/phases/<phase>.md path a candidate `phase` argument names, for the single-file
// lock check -- or null when it is not an existing phase file, so an unknown-phase edit falls through
// to applyPhaseRuleEdit's own error instead of being mis-reported as "a second file".

import { availablePhaseNames } from '../../context/available-phase-names.js';
import { phasePromptPath } from '../../context/phase-prompt-path.js';

/**
 * The absolute rules/phases/<phase>.md path for a candidate `phase` arg (for the single-file lock check),
 * or null if it isn't an existing phase file — so an unknown-phase edit falls through to
 * applyPhaseRuleEdit's own error instead of being mis-reported as a "second file".
 */
export function candidatePhaseFile(phase: unknown): string | null {
  if (typeof phase !== 'string' || phase.trim() === '') return null;
  const normalized = phase.trim().toLowerCase();
  return availablePhaseNames().includes(normalized) ? phasePromptPath(normalized) : null;
}
