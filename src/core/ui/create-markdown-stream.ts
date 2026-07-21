// One assistant turn's streamed output, rendered as markdown. Raw deltas are printed the instant
// they arrive (a local model on a 3060 is slow enough that token-by-token IS the feedback), then the
// moment a line's newline lands the line is repainted in place, formatted.
//
// Why repaint rather than buffer: markdown is only decidable once a line is complete — `**bold**`
// isn't bold until the closing `**` arrives — but buffering whole lines makes a slow model feel
// frozen. So the line is written twice: raw while it streams, styled once it ends.
//
// Why this doesn't break scrollback (the invariant renderer.ts exists to protect): only the
// IN-PROGRESS line is ever rewritten, and it has not scrolled away yet — it is the last thing on
// screen, still under the cursor. Once repainted the line is final and append-only forever after.
// Nothing here touches the alt-buffer, and no already-finished line is ever revisited.
//
// The pinned rows (status-bar.ts) are never at risk: this clears rows with ESC[2K on rows it wrote
// itself, inside the scroll region, and never uses ESC[0J (erase-to-end-of-display), which WOULD
// wipe them.

import { stdout } from 'node:process';

import type { MarkdownStream } from './markdown-stream.type.js';
import { renderMarkdownLine } from './render-markdown-line.js';
import { terminalColumns } from './terminal-columns.js';
import { visibleWidth } from './visible-width.js';

/**
 * Open a markdown stream for one assistant turn. `prefix` is the already-styled attribution
 * (e.g. a colored `discovery ›`) written before the first delta; the stream owns it, because
 * repainting the first line clears the row it sits on and must put it back.
 *
 * Off a TTY there is no cursor to move, so nothing is printed raw and each line is written once,
 * rendered — chalk emits no color there, so piped output is plain text with the markdown syntax
 * consumed rather than a screenful of escape codes.
 */
export function createMarkdownStream(prefix: string): MarkdownStream {
  const tty = stdout.isTTY === true;
  /** Raw text of the line currently streaming, without its newline. */
  let line = '';
  /** True until the first delta writes the prefix — an empty turn must print nothing at all. */
  let prefixPending = true;
  /** True while the prefix sits on the current line's first row (i.e. only for the first line). */
  let prefixOnRow = false;
  /** Whether the NEXT line falls inside a ``` fence — the only state markdown carries across lines. */
  let insideFence = false;

  /** How many terminal rows the raw line currently occupies, prefix included, minimum one. */
  const rowsUsed = (): number => {
    const base = prefixOnRow ? visibleWidth(prefix) : 0;
    return Math.max(1, Math.ceil((base + visibleWidth(line)) / terminalColumns()));
  };

  /**
   * Replace the raw line on screen with its rendered form. The cursor sits on the LAST row of the
   * raw text (which may have wrapped), so: walk up to the line's first row, blank every row it
   * occupied, then write the styled line from the top. Movement stays within rows we just wrote, so
   * the cursor never crosses a scroll margin.
   */
  const flushLine = (): void => {
    const rendered = renderMarkdownLine(line, insideFence);
    insideFence = rendered.insideFence;
    const head = prefixOnRow ? prefix : '';
    if (tty) {
      const rows = rowsUsed();
      if (rows > 1) stdout.write(`\x1b[${rows - 1}A`); // up to the first row of the raw line
      stdout.write('\r');
      for (let row = 0; row < rows; row += 1) {
        stdout.write('\x1b[2K'); // blank this row (never ESC[0J — that would erase the pinned rows)
        if (row < rows - 1) stdout.write('\x1b[1B');
      }
      if (rows > 1) stdout.write(`\x1b[${rows - 1}A`); // back to the top of the now-blank block
      stdout.write('\r');
    }
    stdout.write(`${head}${rendered.text}\n`);
    prefixOnRow = false;
    line = '';
  };

  return {
    push(delta: string): void {
      if (prefixPending) {
        prefixPending = false;
        prefixOnRow = true;
        if (tty) stdout.write(prefix); // off a TTY the prefix is emitted by flushLine instead
      }
      let rest = delta;
      while (rest !== '') {
        const breakAt = rest.indexOf('\n');
        if (breakAt === -1) {
          line += rest;
          if (tty) stdout.write(rest); // live: the raw token, repainted when the line completes
          return;
        }
        const upToBreak = rest.slice(0, breakAt);
        line += upToBreak;
        if (tty) stdout.write(upToBreak);
        flushLine(); // the newline is written by flushLine, after the repaint
        rest = rest.slice(breakAt + 1);
      }
    },
    end(): void {
      if (prefixPending) return; // nothing ever streamed — print nothing, not even a blank line
      // A trailing line the model left unterminated still needs rendering; a turn that ended on a
      // newline has already been flushed and needs no extra blank line.
      if (line !== '' || prefixOnRow) flushLine();
    },
  };
}
