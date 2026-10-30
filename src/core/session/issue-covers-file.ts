// Does an issue's path account for this uncommitted file? A directory named in an issue covers
// everything under it, so the Reviewer can send back a whole folder with one note.
//
// Extracted from verdict-git-conflict.ts, where it was the private `covers` — a name that says nothing
// on its own in a flat folder.

/** True when `file` is named by the issue path `named` (exact file, or a directory containing it). */
export function issueCoversFile(named: string, file: string): boolean {
  return named === file || (named !== '' && file.startsWith(`${named.replace(/\/+$/, '')}/`));
}
