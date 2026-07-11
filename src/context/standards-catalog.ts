// Standards-catalog loader (V4/01). Reads the FRONTMATTER ONLY of every rules/standards/*.md file
// and returns a {name, description} list for search_rules (V4/02) to hand its throwaway-context model.
// The bodies stay on disk until load_rule asks for one, so startup is cheap and the main context never
// holds a standard's body it didn't request (CLAUDE.md, "Rules loading" → "Retrieval").
//
// FAIL LOUD, NEVER SILENT: a standards file with missing/empty/duplicate metadata aborts with a typed
// error naming the offending path — a dropped entry would be invisible to search_rules forever, so a
// standard the model can never reach is worse than a crash at boot.
//
// Read FRESH on every call (never cached), matching phase-prompt.ts: editing a standard's frontmatter
// takes effect on the next call with no restart. Cheap — we parse only the leading `---` block, not bodies.

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { StandardEntry } from './standards-catalog.type.js';

// rules/standards/ sits at the orchestrator repo root, resolved relative to THIS file — never to the
// active project (rules are GLOBAL; projects are agnostic to the orchestrator — CLAUDE.md). This file
// is <root>/src/context/standards-catalog.ts (tsx) or <root>/dist/context/standards-catalog.js (built),
// both two dirs below root, so `../../rules/standards` resolves to the repo root in either run mode.
export const STANDARDS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'rules',
  'standards',
);

/** Typed failure so callers can distinguish malformed-catalog from other I/O errors and abort boot. */
export class StandardsCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StandardsCatalogError';
  }
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

/**
 * Parse ONLY the leading `---`-delimited frontmatter into a StandardEntry. Frontmatter is `name:` /
 * `description:` (single-line values), so a two-key parser is enough and avoids an untyped YAML dep;
 * we split each line on its FIRST `:` so a value may itself contain a colon. Fails loud on a missing
 * block or an empty `name`/`description`.
 */
function parseFrontmatter(raw: string, rel: string): StandardEntry {
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
