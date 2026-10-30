// Is a path the model named actually one of the uncommitted changes?
//
// A DIRECTORY counts when it contains a changed file, because commit_changes documents that "a
// directory commits the changed files under it". The prefix test is `${path}/` rather than `path`, so
// naming `src/a` does not silently accept a change in `src/ab.ts`.

/** True when `path` is itself a changed file, or a directory containing one. */
export function matchesChange(path: string, changed: readonly string[]): boolean {
  return changed.includes(path) || changed.some((file) => file.startsWith(`${path}/`));
}
