// The address form the user types and the /resume listing shows — `design/7a888b1f`. Split out of
// resume.ts.
//
// Named contextAddress rather than the private `address` it was extracted from: a bare `address.ts` in
// a flat folder says nothing about what is being addressed, and `address` is a word four other files
// use as a local for something else.

import { shortContextId } from '../../core/session/index.js';
import type { ContextSummary } from '../../core/session/index.js';

/** The address form the user types and the listing shows — `design/7a888b1f`. */
export function contextAddress(context: ContextSummary): string {
  // shortContextId: the leading UUID characters, which is the whole address form.
  return `${context.phase}/${shortContextId(context.id)}`;
}
