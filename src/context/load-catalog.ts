// Standards-catalog loader (V4/01). Reads the FRONTMATTER ONLY of every rules/standards/*.md file
// and returns a {name, description} list for search_rules (V4/02) to hand its throwaway-context model.
// The bodies stay on disk until load_rule asks for one, so startup is cheap and the main context never
// holds a standard's body it didn't request (docs/rules-loading.md, "Retrieval").
//
// Read FRESH on every call (never cached), matching load-phase-prompt.ts: editing a standard's
// frontmatter takes effect on the next call with no restart. Cheap — we parse only the leading `---`
// block, not bodies.

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { parseFrontmatter } from './parse-frontmatter.js';
import { STANDARDS_DIR, StandardsCatalogError } from './standards-catalog.js';

/**
 * One catalog entry per rules/standards/*.md file, carrying ONLY the frontmatter the search-time
 * throwaway model needs to match intent → file — never the markdown body (bodies load on demand via
 * load_rule, V4/02, so the main context never holds a catalog body it didn't ask for).
 */
export interface StandardEntry {
  /** kebab-case slug, unique across rules/standards/ — the exact argument load_rule(name) takes. */
  name: string;
  /**
   * When-to-use text the throwaway search model matches an intent against — the ONLY signal it gets,
   * since the body is never shown at search time. Written as "Use when …", not just "About …".
   */
  description: string;
}

/**
 * Load the standards catalog: parse the frontmatter of every rules/standards/*.md and return one
 * StandardEntry per file, sorted by filename. Never reads or returns markdown bodies. Throws a
 * StandardsCatalogError naming the offending path when any file lacks a `---` frontmatter block, is
 * missing a non-empty `name`/`description`, or reuses a `name` already claimed by another file.
 */
export function loadCatalog(): StandardEntry[] {
  const files = readdirSync(STANDARDS_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort();

  const entries: StandardEntry[] = [];
  const nameToPath = new Map<string, string>();

  for (const file of files) {
    const rel = path.join('rules', 'standards', file); // repo-relative path for stable error messages
    const raw = readFileSync(path.join(STANDARDS_DIR, file), 'utf-8');
    // parseFrontmatter reads only the leading `---` block and throws, naming `rel`, on a missing
    // block or an empty name/description — so a malformed file never reaches the entry list.
    const entry = parseFrontmatter(raw, rel);

    const claimedBy = nameToPath.get(entry.name);
    if (claimedBy !== undefined) {
      throw new StandardsCatalogError(
        `Duplicate standard name "${entry.name}" in ${rel} and ${claimedBy}. ` +
          `Each rules/standards/ file needs a unique name (it is the load_rule argument).`,
      );
    }
    nameToPath.set(entry.name, rel);
    entries.push(entry);
  }

  return entries;
}
