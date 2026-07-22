// The display width, in terminal columns, of a single Unicode code point: 2 for the East-Asian
// wide / fullwidth and emoji ranges, 1 for everything else. This is the wcwidth distinction the
// terminal itself makes when it lays out a glyph, and — critically — the same one Node's readline
// makes when it positions the cursor while echoing input (getStringWidth). visibleWidth() sums this
// over a string so callers that must know how many rows a line occupies (the input-box erase in
// renderer.ts, the streamed-line repaint in create-markdown-stream.ts) agree with where the terminal
// and readline actually left the cursor. Counting a CJK char as one column (its .length) undercounts
// the row span and strands the erase, which is exactly how a rule used to leak between messages.
//
// Astral non-wide code points (a surrogate pair, .length 2) correctly count as ONE column here, and
// combining marks are left at 1 (rare in typed chat input; matching readline's zero-width handling is
// deliberately out of scope — this file fixes the confirmed wide-glyph undercount only).

/** Terminal columns a single code point occupies: 2 for wide/fullwidth/emoji ranges, else 1. */
export function codePointWidth(cp: number): number {
  if (
    (cp >= 0x1100 && cp <= 0x115f) || // Hangul Jamo
    (cp >= 0x2e80 && cp <= 0x303e) || // CJK radicals, Kangxi
    (cp >= 0x3041 && cp <= 0x33ff) || // Hiragana, Katakana, CJK symbols & punctuation
    (cp >= 0x3400 && cp <= 0x4dbf) || // CJK Unified Ideographs Extension A
    (cp >= 0x4e00 && cp <= 0x9fff) || // CJK Unified Ideographs
    (cp >= 0xa000 && cp <= 0xa4cf) || // Yi Syllables
    (cp >= 0xac00 && cp <= 0xd7a3) || // Hangul Syllables
    (cp >= 0xf900 && cp <= 0xfaff) || // CJK Compatibility Ideographs
    (cp >= 0xfe30 && cp <= 0xfe4f) || // CJK Compatibility Forms
    (cp >= 0xff00 && cp <= 0xff60) || // Fullwidth Forms
    (cp >= 0xffe0 && cp <= 0xffe6) || // Fullwidth signs
    (cp >= 0x1f300 && cp <= 0x1faff) || // emoji, symbols & pictographs
    (cp >= 0x20000 && cp <= 0x3fffd) // CJK Unified Ideographs Extension B and beyond
  ) {
    return 2;
  }
  return 1;
}
