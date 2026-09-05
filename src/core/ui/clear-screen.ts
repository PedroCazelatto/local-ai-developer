// One-time boot clear: wipe the launcher's noise (screen + scrollback), home the cursor.
//
// The ONLY place the whole display is ever cleared. Everything after this is append-only, and the
// pinned rows are owned by status-bar.ts via a scroll region rather than by clearing or redrawing.

/** One-time boot clear: wipe the launcher's noise (screen + scrollback), home the cursor. */
export function clearScreen(): void {
  if (!process.stdout.isTTY) return; // piped/redirected: nothing to clear, escapes would corrupt output
  process.stdout.write('\x1b[2J\x1b[3J\x1b[H'); // clear screen, clear scrollback, cursor home
}
