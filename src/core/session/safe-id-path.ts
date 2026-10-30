// A task id turned into branch-safe path segments. A task id is already a PATH under backlog/ (see
// task.type.ts — "epic-auth/story-signup/01-add-hashing-test") and git branch names take slashes, so the
// id maps straight through and the branch mirrors the backlog tree.

/**
 * The task id as branch-safe path segments: slashes kept (they nest the branch like the backlog),
 * everything git could choke on replaced. Segments that start or end with a dot, and the ".lock"
 * suffix, are illegal in a ref — strip them here rather than discover it at checkout time.
 */
export function safeIdPath(id: string): string {
  return id
    .split('/')
    .map((segment) =>
      segment
        .replace(/[^A-Za-z0-9._-]+/g, '-')
        .replace(/\.lock$/i, '-lock')
        .replace(/-{2,}/g, '-') // after the .lock rewrite, which can itself produce a doubled dash
        .replace(/^[.-]+|[.-]+$/g, ''),
    )
    .filter((segment) => segment !== '')
    .join('/');
}
