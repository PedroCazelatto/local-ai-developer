// How the Retro line names the one file it patched. It was `displayPath` while it was private to the
// old retro-prompt.ts (now render-retro-result.ts); extracted, that name would have read as a general
// path formatter when it only ever takes a RetroResult and only ever answers for a Retro patch.

import path from 'node:path';

import type { RetroResult } from '../core/session/retro-result.type.js';

/** A readable path for the patched file: project-relative when inside the project, else as resolved. */
export function retroPatchedPath(result: RetroResult, projectPath: string): string {
  if (result.scope === 'systemic') {
    return `rules/phases/${path.basename(result.editedFile)}`;
  }
  const rel = path.relative(projectPath, result.editedFile);
  return rel.startsWith('..') ? result.editedFile : rel;
}
