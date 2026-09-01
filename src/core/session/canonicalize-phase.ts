// The SINGLE validation point for a phase name anywhere near the inbox. The markdown file this store
// replaced had none, so a typo silently vanished from every future regex.

import { PHASES } from './inbox-phases.js';
import type { Phase } from './phase.type.js';

/**
 * Canonicalize a phase name to its PascalCase form, or undefined if it is not one of the six. Matches
 * CASE-INSENSITIVELY on purpose: the local model may emit `worker`/`Worker`/`WORKER`, and `ctx.phase`
 * is always lowercase — all fold to the one canonical `Worker`. This is the single validation point
 * (the old markdown file had none, so a typo silently vanished from every future regex).
 */
export function canonicalizePhase(name: string): Phase | undefined {
  const lower = name.trim().toLowerCase();
  return PHASES.find((phase) => phase.toLowerCase() === lower);
}
