// The porcelain parse, shared by the three readers of `git status --porcelain` (capture-changed-files,
// list-changed-paths, diff-paths) so a rename or a quoted path is decoded the same way by all three.

/** Strip a `git status --porcelain` line to its project-relative path (handles rename + quoting). */
export function porcelainPath(line: string): string {
  let p = line.slice(3); // after the 2-char XY status + a space
  const arrow = p.indexOf(' -> ');
  if (arrow !== -1) p = p.slice(arrow + 4); // a rename shows "old -> new"; keep the new path
  return p.trim().replace(/^"(.*)"$/, '$1');
}
