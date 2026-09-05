// The model's own classification plus its one-sentence diagnosis, captured via submit_retro.
// ADVISORY: the path guard, not this, decides whether the edit is committed.

import type { RetroScope } from './retro-scope.type.js';

/** The model's own classification + one-sentence diagnosis, captured via submit_retro (advisory). */
export interface RetroSubmission {
  /** The model's claimed scope — advisory only; the path guard is authoritative for the commit decision. */
  readonly scope: RetroScope;
  /** One-sentence root-cause diagnosis (what upstream gap let the ambiguous task reach execution). */
  readonly rootCause: string;
}
