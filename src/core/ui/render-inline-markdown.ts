// Inline markdown → ANSI: `**bold**`, `*italic*`, `_italic_`, `` `code` ``. Block-level constructs
// (headings, lists, quotes, fences) are render-markdown-line.ts's job; this styles the text INSIDE
// one already-classified line, and is called on that line's content.
//
// One regex pass with alternation, not a chain of .replace() calls: a chain would re-scan text the
// previous pass had already wrapped in escape codes and mangle it (a `*` inside an emitted ANSI
// sequence is not markdown). Alternation order IS precedence — code wins over bold wins over italic,
// so `**text**` is never mis-read as an empty `*` italic wrapping `*text*`.

import { theme } from './theme.js';

/**
 * Capture groups, in alternation order: code, **bold**, __bold__, *italic*, _italic_.
 * The `_italic_` arm requires non-word boundaries so `snake_case_names` are left alone.
 */
const INLINE = /`([^`\n]+)`|\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*|(?<![\w])_([^_\n]+)_(?![\w])/g;

/** Style the inline markdown in `text`, leaving anything unmatched exactly as written. */
export function renderInlineMarkdown(text: string): string {
  return text.replace(INLINE, (match, code?: string, bold?: string, boldAlt?: string, italic?: string, italicAlt?: string) => {
    if (code !== undefined) return theme.md.code(code);
    if (bold !== undefined) return theme.md.bold(bold);
    if (boldAlt !== undefined) return theme.md.bold(boldAlt);
    if (italic !== undefined) return theme.md.italic(italic);
    if (italicAlt !== undefined) return theme.md.italic(italicAlt);
    return match; // unreachable: one arm always matches, but never guess — return the text untouched
  });
}
