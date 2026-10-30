// loadStandardBody (V4/02) — resolve a standard's `name` (the slug search_rules returns) to its full
// markdown body with the YAML frontmatter stripped. This is the read behind the load_rule tool. The
// catalog (V4/01) carries only {name, description}, and the slug is NOT the filename
// (clean-architecture ⇄ clean_architecture.md), so we validate `name` against loadCatalog() — which
// also fails loud on a malformed catalog — then read frontmatter to map name → file. Unknown name →
// { found:false } with the available names, which load_rule turns into a recoverable error.

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { loadCatalog } from './load-catalog.js';
import { splitFrontmatter } from './split-frontmatter.js';
import { STANDARDS_DIR, StandardsCatalogError } from './standards-catalog.js';

/**
 * Result of loadStandardBody: the frontmatter-stripped body of a standard, or a not-found signal
 * carrying the available names. The not-found branch feeds load_rule's recoverable
 * { error, available } — an unknown name never crashes the turn (V1/02).
 */
export type StandardBody =
  | { readonly found: true; readonly body: string }
  | { readonly found: false; readonly available: readonly string[] };

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
    // splitFrontmatter returns the file's declared `name` plus everything after the `---` block —
    // the name is what we match the slug against, the body is what load_rule hands the model.
    const parsed = splitFrontmatter(readFileSync(path.join(STANDARDS_DIR, file), 'utf-8'));
    if (parsed.name === wanted) {
      return { found: true, body: parsed.body };
    }
  }
  // In the catalog but no file carries the name — impossible unless the tree changed mid-call. Fail loud.
  throw new StandardsCatalogError(`standard '${wanted}' is in the catalog but no file carries that name.`);
}
