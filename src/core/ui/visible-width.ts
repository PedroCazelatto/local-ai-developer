// How many terminal columns a string actually occupies. The markdown stream needs this to know how
// many rows a streamed raw line wrapped onto, so it can clear exactly those rows before repainting
// the line formatted (create-markdown-stream.ts) — a miscount there leaves debris on screen.
//
// ANSI escape sequences are stripped because they occupy zero columns. Raw model text carries none,
// but measuring already-styled text (the assistant prefix) must not count its color codes.

/** SGR / CSI escape sequences (`ESC[…m` and friends) — zero-width, so they never count as columns. */
const ANSI = /\x1b\[[0-9;]*[A-Za-z]/g;

/** Visible column count of `text`, ignoring ANSI escapes. */
export function visibleWidth(text: string): number {
  return text.replace(ANSI, '').length;
}
