// The closed set of phases, in canonical PascalCase — the only valid inbox sender, recipient or
// resolver. In one place because three separate things read it: the case-insensitive canonicaliser,
// the project-global id counter (which sums posts across every recipient file), and the resolver
// (which scans every file to find the one holding an id). It mirrors the six rules/phases files.

import type { Phase } from './types.js';

/** The six phases in canonical PascalCase — the closed set every `to`/`from`/recipient is validated against. */
export const PHASES: readonly Phase[] = ['Discovery', 'Design', 'Breakdown', 'Worker', 'Reviewer', 'Retro'];
