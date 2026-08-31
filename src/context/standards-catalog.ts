// The rules/standards/ location and the typed failure a malformed catalog raises — the vocabulary
// shared by load-catalog.ts, parse-frontmatter.ts and load-standard-body.ts. It holds NO function of
// its own: a constant and one error class, which is what lets it keep its name while the functions it
// used to carry moved out under the constitution's one-function-per-file rule.
//
// FAIL LOUD, NEVER SILENT is the reason the error is typed at all: a standards file with
// missing/empty/duplicate metadata aborts with the offending path named, because a dropped entry
// would be invisible to search_rules forever — a standard the model can never reach is worse than a
// crash at boot.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

// rules/standards/ sits at the orchestrator repo root, resolved relative to THIS file — never to the
// active project (rules are GLOBAL; projects are agnostic to the orchestrator — CLAUDE.md). This file
// is <root>/src/context/standards-catalog.ts (tsx) or <root>/dist/context/standards-catalog.js (built),
// both two dirs below root, so `../../rules/standards` resolves to the repo root in either run mode.
export const STANDARDS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'rules',
  'standards',
);

/** Typed failure so callers can distinguish malformed-catalog from other I/O errors and abort boot. */
export class StandardsCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StandardsCatalogError';
  }
}
