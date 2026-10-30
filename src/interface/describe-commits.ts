// One line naming every SHA a task landed, for the batch summary's per-task rows.

/** The SHAs a task landed, as one line. A Reviewer commits in small pieces, so this is usually several. */
export function describeCommits(commits: readonly string[]): string {
  return commits.length === 0 ? '(no sha)' : commits.join(', ');
}
