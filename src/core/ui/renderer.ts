// Persistent-REPL renderer: append-only print helpers. THE whole point of the rewrite is
// preserving scrollback (the old Rich Live(screen=True) TUI grabbed the alt-buffer and the user
// couldn't copy/paste from it — see the "verify via scripted live checks" memory). So: NEVER
// clear the screen, never use the alt-buffer, never own a fixed region. Every helper just
// appends to the normal terminal buffer, so the user can scroll up and copy freely.
//
// Keep this module dumb (pure printing). Turn-loop logic, tool dispatch, and history live in the
// orchestrator (task 06); the UI only displays and collects input.

import { theme } from './theme.js';

const BANNER = 'Local AI Developer  ·  /swap <phase>  ·  /exit';

/** One-time boot banner (ports the old add_system_message banner). */
export function banner(): void {
  process.stdout.write(`${theme.banner(BANNER)}\n\n`);
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

export interface StatusLineInfo {
  readonly project: string;
  readonly phase: string;
  readonly model: string;
  /** EXACT combined token count for the last turn, or null when Ollama did not report it. */
  readonly tokens: number | null;
  readonly numCtx: number;
}

/**
 * Printed status line: `project · phase · model · tokens · num_ctx`. Because we don't own a
 * fixed screen region, this is just another appended line (rendered before each prompt). Tokens
 * are EXACT or `?` — never a fabricated number (CLAUDE.md token rule).
 */
export function statusLine(info: StatusLineInfo): void {
  const tokens = info.tokens === null ? '?' : String(info.tokens);
  const sep = theme.meta(' · ');
  const line = [
    theme.meta(info.project),
    theme.phase(info.phase)(info.phase),
    theme.meta(info.model),
    theme.meta(`${tokens} tok`),
    theme.meta(`ctx ${info.numCtx}`),
  ].join(sep);
  process.stdout.write(`${line}\n`);
}
