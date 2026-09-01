// A UTC ISO timestamp as a filename-safe stamp. Filenames sort chronologically because the stamp keeps
// its field order; the punctuation is dropped because a colon is not legal in a Windows filename.

/** UTC ISO → a filename-safe stamp: `2026-07-11T03:04:05.678Z` → `20260711T030405Z` (no colons/dots). */
export function compactTimestamp(iso: string): string {
  return iso.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}
