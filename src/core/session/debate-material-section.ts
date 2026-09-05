// The material section of a debate seed, or nothing at all.
//
// An empty "## Material" header would invite invention: a local model handed a section with no content
// fills it in. Both seeds share this so the challenger and the proponent are given the material in
// exactly the same words.

import type { DebateRequest } from './debate-request.type.js';

/** The material section, or nothing at all — an empty "Material:" header would invite invention. */
export function debateMaterialSection(request: DebateRequest): string {
  const background = request.background?.trim();
  return background === undefined || background === '' ? '' : `\n## Material\n\n${background}\n`;
}
