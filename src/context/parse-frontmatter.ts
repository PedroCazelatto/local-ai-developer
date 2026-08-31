// parseFrontmatter — the validating half of the standards catalog (V4/01). Turns one standards
// file's raw text into its StandardEntry, or throws naming the file.
//
// Distinct from splitFrontmatter (split-frontmatter.ts), which runs later, on a tree this has already
// validated, and wants the BODY rather than the metadata.

import type { StandardEntry } from './load-catalog.js';
import { StandardsCatalogError } from './standards-catalog.js';

/**
 * Parse ONLY the leading `---`-delimited frontmatter into a StandardEntry. Frontmatter is `name:` /
 * `description:` (single-line values), so a two-key parser is enough and avoids an untyped YAML dep;
 * we split each line on its FIRST `:` so a value may itself contain a colon. Fails loud on a missing
 * block or an empty `name`/`description`, naming `rel` — the repo-relative path of the offender.
 */
export function parseFrontmatter(raw: string, rel: string): StandardEntry {
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  if (block === null) {
    throw new StandardsCatalogError(
      `Missing YAML frontmatter (leading --- block) in ${rel}. ` +
        `Every standards file needs name + description frontmatter.`,
    );
  }

  const fields = new Map<string, string>();
  for (const line of (block[1] ?? '').split(/\r?\n/)) {
    const trimmed = line.trim();
    const colon = trimmed.indexOf(':');
    if (colon === -1) continue; // blank line or comment — ignore
    fields.set(trimmed.slice(0, colon).trim(), trimmed.slice(colon + 1).trim());
  }

  const name = (fields.get('name') ?? '').trim();
  const description = (fields.get('description') ?? '').trim();
  if (name === '') {
    throw new StandardsCatalogError(`Frontmatter in ${rel} is missing a non-empty "name".`);
  }
  if (description === '') {
    throw new StandardsCatalogError(`Frontmatter in ${rel} is missing a non-empty "description".`);
  }
  return { name, description };
}
