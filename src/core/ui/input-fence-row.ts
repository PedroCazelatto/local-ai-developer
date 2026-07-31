// The single input row painted between the two rules while a turn runs — the `›` line of the fence
// that now stays on screen instead of vanishing the moment the model starts working.
//
// It shows one of two things:
//   - nothing typed yet → a dim hint, because an empty box that swallows Enter has to say so. The
//     hint states BOTH halves of the deal: typing works now, Enter works when the turn ends.
//   - text typed → the tail of it plus a drawn caret. The tail (never the head) keeps the newest
//     characters visible, and clamping to the row's width is load-bearing: this is a RESERVED row
//     outside the scroll region, where an overflow would smear into the pinned status lines.
//
// The marker is renderer.INPUT_PROMPT itself, not a copy of it, so the busy row and the real prompt
// can never drift apart visually — the whole point of the fence is that the box looks unchanged
// while the turn runs.

import { INPUT_PROMPT } from './renderer.js';
import { tailToWidth } from './tail-to-width.js';
import { theme } from './theme.js';
import { truncateToWidth } from './truncate-to-width.js';
import { visibleWidth } from './visible-width.js';

/** Shown while the type-ahead buffer is empty. Cut to the row's width on a narrow terminal. */
const HINT = 'type ahead — press Enter once the turn ends';

/** The styled input row for `typed`, fitted to `columns` (the caret's column included). */
export function inputFenceRow(typed: string, columns: number): string {
  const budget = columns - visibleWidth(INPUT_PROMPT);
  if (budget < 1) return INPUT_PROMPT; // a terminal too narrow for content still gets the marker
  if (typed === '') return `${INPUT_PROMPT}${theme.meta(truncateToWidth(HINT, budget))}`;
  // truncateToWidth measures with .length, which is why the HINT above is ASCII and the typed text
  // (any script, any emoji) goes through tailToWidth instead.
  return `${INPUT_PROMPT}${tailToWidth(typed, budget - 1)}${theme.caret(' ')}`;
}
