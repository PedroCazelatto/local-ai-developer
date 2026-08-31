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

import * as activityLine from './activity-line.js';
import { createMarkdownStream } from './create-markdown-stream.js';
import { echoedRows } from './echoed-rows.js';
import { INPUT_PROMPT } from './input-prompt.js';
import type { MarkdownStream } from './types.js';
import { terminalColumns } from './terminal-columns.js';
import { theme } from './theme.js';
import { userMessageBars } from './user-message-bars.js';

/** The REPL input prompt. Re-exported so the input-box erase math measures the string readline echoes. */
export { INPUT_PROMPT };

/** The stream rendering the turn right now, or null between turns — interjectLine prints around it. */
let live: MarkdownStream | null = null;

/** One-time boot clear: wipe the launcher's noise (screen + scrollback), home the cursor. */
export function clearScreen(): void {
  if (!process.stdout.isTTY) return; // piped/redirected: nothing to clear, escapes would corrupt output
  process.stdout.write('\x1b[2J\x1b[3J\x1b[H'); // clear screen, clear scrollback, cursor home
}

/**
 * Open the output sink for ONE streamed assistant turn: deltas in, markdown on screen. The reply
 * carries NO phase-name prefix — which phase is active is shown by the pinned status line, so the
 * response text starts at the margin (empty prefix; see create-markdown-stream.ts).
 *
 * Call once per turn, on the FIRST visible delta, so a pure tool-call turn prints no empty header.
 */
export function assistantStream(): MarkdownStream {
  const stream = createMarkdownStream('');
  // Held so interjectLine below can print THROUGH a reply in flight. Released by end(), which the turn
  // loop always calls — including on a turn that produced no prose at all.
  live = stream;
  return {
    push: (delta) => stream.push(delta),
    end: () => {
      stream.end();
      live = null;
    },
    interject: (block) => stream.interject(block),
  };
}

/**
 * Print one line into the scrollback that must arrive NOW, whatever owns the cursor row. A reply being
 * streamed is lifted and laid back down around it (create-markdown-stream's interject); the transient
 * activity line is hidden and shown again. Without this the line would land in the middle of a
 * half-written sentence — the reason it exists is a message queued mid-turn.
 */
export function interjectLine(text: string): void {
  if (live !== null) {
    live.interject(text);
    return;
  }
  const wasVisible = activityLine.isVisible();
  if (wasVisible) activityLine.hide();
  stdout.write(`${text}\n`);
  if (wasVisible) activityLine.show();
}

/** A single blank line — the separator between turns (history is blank-separated, never ruled). */
export function blankLine(): void {
  stdout.write('\n');
}

/**
 * The transient rule printed directly ABOVE the live input. It is erased when the message is
 * committed (commitUserMessage), so it never lands in history — the pinned rule BELOW the input
 * (status-bar.ts) is the other half of the fence. TTY only: off a TTY there is no cursor to erase it
 * with later, so it is simply omitted.
 */
export function inputRuleTop(): void {
  if (!stdout.isTTY) return;
  stdout.write(`${theme.divider('─'.repeat(terminalColumns()))}\n`);
}

/**
 * Erase the transient input box still under the cursor — the top rule plus every row the echoed input
 * wrapped onto — leaving the cursor at the box's first row, column 1. Clears with ESC[2K on rows we
 * wrote ourselves (never ESC[0J, which would wipe the pinned status rows below the scroll region).
 *
 * echoedRows measures the PROMPT + input together, wrapping exactly as readline does (so an exact-fill
 * line's deferred-wrap row and wide glyphs are both counted) — that keeps `rows` matched to where
 * readline left the cursor, so the top rule is always cleared and never leaks into scrollback.
 */
function eraseInputBox(raw: string): void {
  const rows = echoedRows(`${INPUT_PROMPT}${raw}`) + 1; // + the top rule
  stdout.write(`\x1b[${rows}A\r`); // up to the top rule's row, column 1
  for (let row = 0; row < rows; row += 1) {
    stdout.write('\x1b[2K');
    if (row < rows - 1) stdout.write('\x1b[1B');
  }
  stdout.write(`\x1b[${rows - 1}A\r`); // back to the top of the now-blank block
}

/**
 * Collapse the just-submitted input box into a static, copyable gray block: the user's message on a
 * light-gray background, then a blank line before the assistant reply. This is the transient-widget
 * pattern (constitution, Terminal UX) — the live box erases its own frame and leaves a single summary
 * in the append-only scrollback. Off a TTY nothing was erasable, so it just prints the summary.
 */
export function commitUserMessage(raw: string): void {
  // userMessageBars: the message word-wrapped under a ` › ` marker as full-width gray rows.
  const bars = userMessageBars(raw, terminalColumns());
  if (stdout.isTTY) eraseInputBox(raw);
  stdout.write(`${bars.join('\n')}\n\n`);
}

/**
 * Print a message that was never in the live input box — one queued mid-turn, running now that its
 * turn came. Same gray block as a typed message, since by this point it IS the user's turn; there is
 * simply no input box to collapse, and a leading blank line stands in for the separator the prompt
 * would have printed above it.
 */
export function printUserMessage(raw: string): void {
  const bars = userMessageBars(raw, terminalColumns());
  stdout.write(`\n${bars.join('\n')}\n\n`);
}

/** An empty submit adds nothing to history — just erase the box (TTY) and move on. */
export function discardInput(raw: string): void {
  if (stdout.isTTY) eraseInputBox(raw);
}

/** Dimmed inline meta line, e.g. `→ tool: read_file` (ports ui.add_system_message). */
export function systemMessage(text: string): void {
  process.stdout.write(`${theme.meta(text)}\n`);
}

/** Recoverable-error line (unknown /swap phase, surfaced tool error). Never throws out. */
export function errorLine(text: string): void {
  process.stdout.write(`${theme.error(text)}\n`);
}
