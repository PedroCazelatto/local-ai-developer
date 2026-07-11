// Type for the standards catalog (V4/01), beside standards-catalog.ts (constitution: types in a
// sibling file). One StandardEntry per rules/standards/*.md file, carrying ONLY the frontmatter the
// search-time throwaway model needs to match intent → file — never the markdown body (bodies load on
// demand via load_rule, V4/02, so the main context never holds a catalog body it didn't ask for).

export interface StandardEntry {
  /** kebab-case slug, unique across rules/standards/ — the exact argument load_rule(name) takes. */
  name: string;
  /**
   * When-to-use text the throwaway search model matches an intent against — the ONLY signal it gets,
   * since the body is never shown at search time. Written as "Use when …", not just "About …".
   */
  description: string;
}
