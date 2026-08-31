// The one home for the plain stdout line — the identical body is declared privately in six more files
// today (interface/batch-summary.ts, interface/retro-prompt.ts, interface/review-prompt.ts, and the
// /help, /resume and /subagents commands). It is UI, so it lives here beside renderer.ts, but it is
// deliberately NOT part of the renderer: renderer's lines carry theme and scroll-region awareness,
// while this is the raw row a hand-painted table is built out of. The one-function-per-file sweep
// repoints each copy here as it reaches that copy's directory; a file still declaring its own has
// simply not been swept yet.

/** Write `line` to stdout, newline included. */
export function write(line: string): void {
  process.stdout.write(`${line}\n`);
}
