// Persistent-REPL renderer: append-only print helpers. THE whole point of the rewrite is
// preserving scrollback (the old Rich Live(screen=True) TUI grabbed the alt-buffer and the user
// couldn't copy/paste from it — see the "verify via scripted live checks" memory). So: never use
// the alt-buffer, and never repaint HISTORY — anything that has scrolled is immutable, so the user
// can scroll up and copy freely. The one-time clearScreen() at boot wipes launcher noise; the pinned
// rows are owned by status-bar.ts via a scroll region, not by clearing or redrawing here.
//
// Live output is the one nuance (constitution, Terminal UX): assistantStream rewrites the line it is
// CURRENTLY streaming — still under the cursor, not yet history — to render its markdown once the
// line completes. Every line it leaves behind is final. Transient widgets (ask-questions.ts, the
// spinner) may likewise repaint their own frame, then must collapse into one static, copyable summary.
//
// Keep this module dumb (pure printing). Turn-loop logic, tool dispatch, and history live in the
// orchestrator (task 06); the UI only displays and collects input.

import { stdout } from 'node:process';

import { createMarkdownStream } from './create-markdown-stream.js';
import type { MarkdownStream } from './markdown-stream.type.js';
import { terminalColumns } from './terminal-columns.js';
import { theme } from './theme.js';

const BANNER = 'Local AI Developer  ·  /swap <phase>  ·  /exit';

/** One-time boot clear: wipe the launcher's noise (screen + scrollback), home the cursor. */
export function clearScreen(): void {
  if (!process.stdout.isTTY) return; // piped/redirected: nothing to clear, escapes would corrupt output
  process.stdout.write('\x1b[2J\x1b[3J\x1b[H'); // clear screen, clear scrollback, cursor home
}

/**
 * One-time boot banner. The live session context (project · phase · model · tokens · num_ctx) lives
 * in the pinned status bar below the input — NOT here — so it never scrolls above the conversation.
 */
export function header(): void {
  process.stdout.write(`${theme.banner(BANNER)}\n\n`);
}

/**
 * Open the output sink for ONE streamed assistant turn: deltas in, markdown on screen. The colored
 * `discovery ›` attribution is the stream's prefix — it owns it because repainting the first line
 * clears the row the prefix sits on and has to restore it (see create-markdown-stream.ts).
 *
 * Call once per turn, on the FIRST visible delta, so a pure tool-call turn prints no empty header.
 */
export function assistantStream(phase: string): MarkdownStream {
  return createMarkdownStream(`${theme.phase(phase)(`${phase} ›`)} `);
}

/** A dim full-width horizontal rule — fences the input line (repl.ts). */
export function rule(): void {
  stdout.write(`${theme.divider('─'.repeat(terminalColumns()))}\n`);
}

/** Dimmed inline meta line, e.g. `→ tool: read_file` (ports ui.add_system_message). */
export function systemMessage(text: string): void {
  process.stdout.write(`${theme.meta(text)}\n`);
}

/** Recoverable-error line (unknown /swap phase, surfaced tool error). Never throws out. */
export function errorLine(text: string): void {
  process.stdout.write(`${theme.error(text)}\n`);
}
