// The field separator both readers of `git stash list` format with, so a branch name containing ": "
// cannot split the parse. In one place because list-shelves.ts and find-shelf-ref.ts must format and
// split on the same character or one of them silently stops matching.

/** ASCII unit separator — splits the `git stash list` fields. Cannot occur in a label or branch name. */
export const FIELD_SEPARATOR = '\x1f';
