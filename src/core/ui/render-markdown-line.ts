// One line of markdown → one line of ANSI. This is the block-level classifier: it decides WHAT a
// line is (fence, code, rule, heading, quote, list, prose) and maps it onto a theme.md role; the
// text inside the line is styled by render-inline-markdown.ts.
//
// Line-based on purpose. The model streams token by token, so the renderer can only ever act on a
// line once its newline arrives (create-markdown-stream.ts) — and every markdown construct that
// matters here is decidable from one line plus one bit of carried state (are we inside a ``` fence).
// Constructs that genuinely span lines (tables, lazy continuation) are left as prose rather than
// half-rendered.
//
// Markdown SYNTAX is consumed, not printed: `### Round 1` renders as a bold cyan `Round 1`, never as
// a bold cyan `### Round 1`. The syntax was only ever the model's way of naming the role.

import { renderInlineMarkdown } from './render-inline-markdown.js';
import { terminalColumns } from './terminal-columns.js';
import { theme } from './theme.js';

/** One rendered markdown line plus the fence state the NEXT line must be rendered with. */
export interface RenderedMarkdownLine {
  /** The line, styled with ANSI — ready to write verbatim. */
  readonly text: string;
  /**
   * Whether the line AFTER this one falls inside a ``` fenced block. Markdown is line-based except
   * for fences, so this one bit is the entire carried state: the caller threads it back in on the
   * next call (create-markdown-stream.ts owns it for a turn).
   */
  readonly insideFence: boolean;
}

/** A ``` (or ~~~) fence marker, opening or closing, with an optional language tag. */
const FENCE = /^\s*(?:```|~~~)/;
/** A thematic break: three or more -, *, or _ with optional spaces, and nothing else. */
const THEMATIC_BREAK = /^\s*(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$/;
/** `#`…`######` + a space + the heading text. */
const HEADING = /^(#{1,6})\s+(.*)$/;
/** `>` + optional space + the quoted text. */
const BLOCKQUOTE = /^\s*>\s?(.*)$/;
/** Indent + a -, *, or + bullet + a space + the item text. */
const BULLET_ITEM = /^(\s*)[-*+]\s+(.*)$/;
/** Indent + digits + . or ) + a space + the item text. */
const ORDERED_ITEM = /^(\s*)(\d+)[.)]\s+(.*)$/;

/**
 * Render `raw` as one styled line. `insideFence` says whether the PREVIOUS line left us inside a
 * fenced code block; the returned `insideFence` is what to pass on the next call.
 */
export function renderMarkdownLine(raw: string, insideFence: boolean): RenderedMarkdownLine {
  // A fence marker toggles the state and prints dim — it delimits, it is not content.
  if (FENCE.test(raw)) {
    return { text: theme.md.fence(raw.trimEnd()), insideFence: !insideFence };
  }
  // Inside a fence every line is code, verbatim: no inline styling, no block classification. A `#`
  // in a shell script is a comment, not a heading.
  if (insideFence) {
    return { text: theme.md.code(raw), insideFence };
  }
  if (THEMATIC_BREAK.test(raw)) {
    return { text: theme.md.rule('─'.repeat(terminalColumns())), insideFence };
  }
  const heading = HEADING.exec(raw);
  if (heading?.[1] !== undefined && heading[2] !== undefined) {
    return { text: theme.md.heading(heading[1].length)(renderInlineMarkdown(heading[2])), insideFence };
  }
  const quote = BLOCKQUOTE.exec(raw);
  if (quote?.[1] !== undefined) {
    return { text: `${theme.md.quoteBar('│')} ${theme.md.quote(renderInlineMarkdown(quote[1]))}`, insideFence };
  }
  const bullet = BULLET_ITEM.exec(raw);
  if (bullet?.[1] !== undefined && bullet[2] !== undefined) {
    return { text: `${bullet[1]}${theme.md.bullet('•')} ${renderInlineMarkdown(bullet[2])}`, insideFence };
  }
  const ordered = ORDERED_ITEM.exec(raw);
  if (ordered?.[1] !== undefined && ordered[2] !== undefined && ordered[3] !== undefined) {
    return { text: `${ordered[1]}${theme.md.bullet(`${ordered[2]}.`)} ${renderInlineMarkdown(ordered[3])}`, insideFence };
  }
  return { text: renderInlineMarkdown(raw), insideFence };
}
