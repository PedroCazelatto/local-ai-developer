// Remove any attribution trailer the commit-message writer invented, whatever the prompt said.
//
// `stripAttributionTrailers`, not `stripTrailers`: it drops exactly the five that name a PERSON and
// leaves every other git trailer alone, and the difference is load-bearing rather than pedantic. This
// is the mechanical half of "never write the user's name into any file" (constitution, Repo hygiene)
// -- the prompt forbids a trailer AND this drops one anyway, because a confidently-wrong local model
// must not be able to sign a commit. A name that implied it removed all trailers would invite someone
// to reach for it for tidying, and then to widen it.

/** Remove any attribution trailer the writer invented, whatever the prompt said. */
export function stripAttributionTrailers(lines: string[]): string[] {
  return lines.filter((line) => !/^\s*(signed-off-by|co-authored-by|authored-by|author|committer)\s*:/i.test(line));
}
