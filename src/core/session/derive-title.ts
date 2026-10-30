// A task's human title: the body's own H1 when it has one, else a Title-Cased version of the file
// slug with its order prefix stripped. There is always a title, because it is what the branch name and
// every progress line read from.

/** First `# Heading` in the body, else a Title-Cased version of the file slug (sans order prefix). */
export function deriveTitle(body: string, slug: string): string {
  const h1 = /^#\s+(.+?)\s*$/m.exec(body);
  if (h1 && h1[1]) return h1[1].trim();
  return slug
    .replace(/^\d+[-_]?/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}
