// Result of loadStandardBody (V4/02): the frontmatter-stripped body of a standard, or a not-found
// signal carrying the available names. Sibling type file (constitution). The not-found branch feeds
// load_rule's recoverable { error, available } — an unknown name never crashes the turn (V1/02).

export type StandardBody =
  | { readonly found: true; readonly body: string }
  | { readonly found: false; readonly available: readonly string[] };
