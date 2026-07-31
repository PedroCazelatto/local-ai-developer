// Keep the LAST `width` columns of a PLAIN string — the horizontal scroll of a one-row input field.
//
// The type-ahead row painted while a turn runs (input-fence-row.ts) lives on a RESERVED row outside
// the scroll region. A string wider than the terminal would not wrap harmlessly there: it would run
// on into the next reserved row and smear the pinned status lines. So the row shows the tail, which
// is also what a typist wants — the end of what they just typed, not the start.
//
// The tail rather than the head is why this is not truncateToWidth: that one cuts the end off and
// marks the cut, which is right for a label and wrong for a field being typed into. Widths come from
// codePointWidth so a CJK/emoji glyph counts as the two columns it occupies, and iterating by code
// point keeps a surrogate pair whole — a cut between its halves would print a replacement char.

import { codePointWidth } from './code-point-width.js';

/** The trailing part of `text` that fits in `width` columns (whole glyphs only; '' below 1 column). */
export function tailToWidth(text: string, width: number): string {
  if (width < 1) return '';
  const glyphs = [...text];
  let used = 0;
  let start = glyphs.length;
  for (let index = glyphs.length - 1; index >= 0; index -= 1) {
    const glyph = glyphs[index];
    if (glyph === undefined) break;
    const cost = codePointWidth(glyph.codePointAt(0) ?? 0);
    if (used + cost > width) break; // a wide glyph that only half fits is dropped, never split
    used += cost;
    start = index;
  }
  return glyphs.slice(start).join('');
}
