// The first readable line of a multi-line message, capped — how the batch summary shows a Reviewer's
// last feedback or a blocker's question without letting the whole message run down the report.
//
// It was `firstLine` while it was private to the old batch-summary.ts (now render-batch-summary.ts).
// Extracting it promotes the name to a repo-visible one, and `firstLine` would have lied about the
// half of the job that TRUNCATES.

/** First non-empty line of a multi-line message, trimmed to `max` chars (feedback / blocker question). */
export function firstLinePreview(text: string, max = 120): string {
  const line = (text.split('\n').find((l) => l.trim() !== '') ?? '').trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}
