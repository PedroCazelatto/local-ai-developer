// loadStandardBody (V4/02) — resolve a standard's `name` (the slug search_rules returns) to its full
// markdown body with the YAML frontmatter stripped. This is the read behind the load_rule tool. The
// catalog (V4/01) carries only {name, description}, and the slug is NOT the filename
// (clean-architecture ⇄ clean_architecture.md), so we validate `name` against loadCatalog() — which
// also fails loud on a malformed catalog — then read frontmatter to map name → file. Unknown name →
// { found:false } with the available names, which load_rule turns into a recoverable error.

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { StandardBody } from './load-standard-body.type.js';
import { loadCatalog, STANDARDS_DIR, StandardsCatalogError } from './standards-catalog.js';

/** Same leading `---`-delimited frontmatter format loadCatalog parses (see standards-catalog.ts). */
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * Return the frontmatter-stripped body of the standard named `name`, or { found:false } with the
 * catalog's available names. Throws StandardsCatalogError only on a genuinely inconsistent tree (a
 * catalog name with no matching file) or a malformed catalog surfaced by loadCatalog.
 */
export function loadStandardBody(name: string): StandardBody {
  const wanted = name.trim();
  // loadCatalog() validates every standards file (fail loud on missing/duplicate frontmatter) and gives
  // the authoritative name list for both the membership check and the not-found `available` list.
  const available = loadCatalog().map((entry) => entry.name);
  if (!available.includes(wanted)) {
    return { found: false, available };
  }

  for (const file of readdirSync(STANDARDS_DIR).filter((f) => f.endsWith('.md'))) {
    const parsed = splitFrontmatter(readFileSync(path.join(STANDARDS_DIR, file), 'utf-8'));
    if (parsed.name === wanted) {
      return { found: true, body: parsed.body };
    }
  }
  // In the catalog but no file carries the name — impossible unless the tree changed mid-call. Fail loud.
  throw new StandardsCatalogError(`standard '${wanted}' is in the catalog but no file carries that name.`);
}

/**
 * Split the leading frontmatter into its `name` and the body after it. We need only `name` here (to
 * locate the matching file) — loadCatalog already validated the frontmatter, so this stays minimal.
 * Drops the frontmatter block and any blank lines before the first content line.
 */
function splitFrontmatter(raw: string): { name: string; body: string } {
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
