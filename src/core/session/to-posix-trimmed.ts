// Path normalisation for comparing a path the MODEL wrote against a path git reported. The model may
// echo either separator, and may pad it with whitespace, and a verdict must not turn on either.
//
// The name carries the distinguishing behaviour on purpose. `src/tools/` declares its own `toPosix`
// twice, and it is NOT this function: it strips TRAILING SLASHES and does not trim, so its callers
// write `toPosix(entry.trim())` to make up the difference. One name for two behaviours in sibling
// folders is a trap, so this half says which normalisation it performs.
//
// It deliberately leaves a trailing slash alone. issue-covers-file.ts strips one itself, on the
// ISSUE'S side only, which is what lets an issue naming `src/` cover `src/a.ts` while an outstanding
// path keeps whatever shape git gave it. Stripping here would make that strip dead code.

/** Backslashes to forward slashes, trimmed — for comparing paths from two sources. */
export function toPosixTrimmed(value: string): string {
  return value.replace(/\\/g, '/').trim();
}
