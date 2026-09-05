// One line of a debate digest: a non-empty single line, capped.
//
// Named digestLine rather than the module-private `asLine` it was extracted from. Deliberately NOT
// named as the singular twin of digest-line-list.ts — two file names a single letter apart is how a
// reader picks the wrong one.

/** Cap one digest line, so a distiller that ignored "25 words" cannot hand the caller a paragraph. */
const LINE_LIMIT = 200;

/** One list entry / the `revise` line: a non-empty single line, capped. Null when unusable. */
export function digestLine(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  // Collapse any newline a model wrote inside a "one line" string, so a row can never break the layout.
  const text = value.replace(/\s*\r?\n\s*/g, ' ').trim();
  if (text === '') return null;
  return text.length <= LINE_LIMIT ? text : `${text.slice(0, LINE_LIMIT).trimEnd()}…`;
}
