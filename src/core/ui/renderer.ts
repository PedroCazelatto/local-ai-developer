// Persistent-REPL renderer: append-only print helpers. THE whole point of the rewrite is
// preserving scrollback (the old Rich Live(screen=True) TUI grabbed the alt-buffer and the user
// couldn't copy/paste from it — see the "verify via scripted live checks" memory). So: never use
// the alt-buffer and never repaint history — every helper just appends to the normal terminal
// buffer, so the user can scroll up and copy freely. The one-time clearScreen() at boot wipes
// launcher noise; the single pinned status row is owned by status-bar.ts via a scroll region, not
// by clearing or redrawing here.
//
// Keep this module dumb (pure printing). Turn-loop logic, tool dispatch, and history live in the
// orchestrator (task 06); the UI only displays and collects input.

import { theme } from './theme.js';

const BANNER = 'Local AI Developer  ·  /swap <phase>  ·  /exit';

/** One-time boot clear: wipe the launcher's noise (screen + scrollback), home the cursor. */
export function clearScreen(): void {
  if (!process.stdout.isTTY) return; // piped/redirected: nothing to clear, escapes would corrupt output
  process.stdout.write('\x1b[2J\x1b[3J\x1b[H'); // clear screen, clear scrollback, cursor home
}

/** Fields shown in the one-time boot header (the live per-turn line lives in the pinned status bar). */
export interface HeaderInfo {
  readonly project: string;
  readonly model: string;
  readonly numCtx: number;
}

/** One-time boot header: the banner plus the static session context (project · model · num_ctx). */
export function header(info: HeaderInfo): void {
  const context = theme.meta(`${info.project} · ${info.model} · ctx ${info.numCtx}`);
  process.stdout.write(`${theme.banner(BANNER)}\n${context}\n\n`);
}

/**
 * Colored attribution printed once before a streamed assistant turn, e.g. `discovery ›`. No
 * trailing newline — the streamed prose continues inline on the same line.
 */
export function assistantPrefix(phase: string): void {
  process.stdout.write(`${theme.phase(phase)(`${phase} ›`)} `);
}

/** Write one streamed delta immediately (token-by-token), no redraw / no clear. */
export function streamDelta(text: string): void {
  process.stdout.write(text);
}

/** Close a streamed assistant block with a newline. */
export function endAssistant(): void {
  process.stdout.write('\n');
}

/** Dimmed inline meta line, e.g. `→ tool: read_file` (ports ui.add_system_message). */
export function systemMessage(text: string): void {
  process.stdout.write(`${theme.meta(text)}\n`);
}

/** Recoverable-error line (unknown /swap phase, surfaced tool error). Never throws out. */
export function errorLine(text: string): void {
  process.stdout.write(`${theme.error(text)}\n`);
}
