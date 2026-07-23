// Split a single "word" (no spaces) that is wider than `width` into display-width-sized pieces — the
// last-resort break for a token that can never fit on one row (a long URL, a run of CJK). Only used
// when word-wrapping has no space to break at. ANSI escapes ride along (zero width) attached to the
// piece they precede; a wide glyph that would straddle the edge starts the next piece instead of
// being split down the middle.

import { codePointWidth } from './code-point-width.js';
import { visibleWidth } from './visible-width.js';

/** One ANSI CSI escape, or one full code point (surrogate pair kept whole via the `u` flag). */
const TOKEN = /\x1b\[[0-9;]*[A-Za-z]|[\s\S]/gu;

/** `word` split into pieces each at most `width` display columns wide (word itself if it already fits). */
export function fitWord(word: string, width: number): string[] {
  if (width <= 0 || visibleWidth(word) <= width) return [word];
  const pieces: string[] = [];
  let piece = '';
  let used = 0;
  for (const [token] of word.matchAll(TOKEN)) {
    if (token.startsWith('\x1b')) {
      piece += token; // escape: zero width, just carry it
      continue;
    }
    const w = codePointWidth(token.codePointAt(0) ?? 0);
    if (used + w > width) {
      pieces.push(piece);
      piece = '';
      used = 0;
    }
    piece += token;
    used += w;
  }
  if (piece !== '') pieces.push(piece);
  return pieces;
}
