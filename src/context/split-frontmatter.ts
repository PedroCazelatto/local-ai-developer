// splitFrontmatter — split one standards file's raw text into the `name` its frontmatter claims and
// the body after it. The read half of load_rule (V4/02): loadStandardBody scans rules/standards/ for
// the file whose frontmatter name matches the slug it was asked for, because the slug is NOT the
// filename (clean-architecture ⇄ clean_architecture.md).
//
// Deliberately minimal, and NOT the catalog parser: parseFrontmatter (parse-frontmatter.ts) has
// already validated every file and fails loud on missing/duplicate metadata, so by the time this runs
// the block is known-good and only `name` is still needed. A file with no block yields an empty name,
// which simply matches nothing.

/** Same leading `---`-delimited frontmatter format the catalog parses (see parse-frontmatter.ts). */
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * Split the leading frontmatter into its `name` and the body after it. Drops the frontmatter block
 * and any blank lines before the first content line, so the body starts on real content.
 */
export function splitFrontmatter(raw: string): { name: string; body: string } {
  const block = FRONTMATTER.exec(raw);
  if (block === null) {
    return { name: '', body: raw };
  }
  let name = '';
  for (const line of (block[1] ?? '').split(/\r?\n/)) {
    const trimmed = line.trim();
    const colon = trimmed.indexOf(':');
    if (colon !== -1 && trimmed.slice(0, colon).trim() === 'name') {
      name = trimmed.slice(colon + 1).trim();
      break;
    }
  }
  const consumed = block[0] ?? '';
  return { name, body: raw.slice(consumed.length).replace(/^\r?\n+/, '') };
}
