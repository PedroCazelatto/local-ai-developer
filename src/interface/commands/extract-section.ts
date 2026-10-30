// Pull one `## <heading>` section body out of a markdown document. Split out of run.ts, where it
// served the Worker's PRODUCT_SPEC.md excerpt.
//
// Deliberately NOT the frontmatter splitters: context/split-frontmatter.ts and
// core/session/split-task-frontmatter.ts both read a leading `---` fence, and this reads a heading in
// the body. Three functions, three jobs, three names.

/** Extract a `## <heading>` section body from markdown, up to the next `## ` or EOF. */
export function extractSection(markdown: string, heading: string): string {
  const lines = markdown.split('\n');
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (start === -1) return '';
  const body: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if ((lines[i] ?? '').startsWith('## ')) break;
    body.push(lines[i] ?? '');
  }
  return body.join('\n').trim();
}
