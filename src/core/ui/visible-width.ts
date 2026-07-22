// How many terminal columns a string actually occupies. The input-box erase (renderer.ts) and the
// markdown stream (create-markdown-stream.ts) both need this to know how many rows a line wrapped
// onto, so they can move/clear exactly those rows — a miscount strands debris (a rule that leaks
// between messages, streamed-line remnants) on screen.
//
// Two things make "columns occupied" differ from `.length`:
//   - ANSI escape sequences are stripped: they occupy zero columns. Raw model text carries none, but
//     measuring already-styled text (the assistant prefix, a colored question bar) must not count its
//     color codes.
//   - Wide glyphs (CJK, fullwidth, emoji) occupy TWO columns while `.length` counts one — the same
//     wcwidth call the terminal and Node's readline make. We therefore iterate CODE POINTS (so a
//     surrogate pair is one glyph) and add each one's width via codePointWidth.

import { codePointWidth } from './code-point-width.js';

/** SGR / CSI escape sequences (`ESC[…m` and friends) — zero-width, so they never count as columns. */
const ANSI = /\x1b\[[0-9;]*[A-Za-z]/g;

/** Visible column count of `text`: ANSI escapes ignored, wide glyphs counted as two columns. */
export function visibleWidth(text: string): number {
  let width = 0;
  for (const glyph of text.replace(ANSI, '')) width += codePointWidth(glyph.codePointAt(0) ?? 0);
  return width;
}
