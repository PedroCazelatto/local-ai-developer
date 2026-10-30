// Strip the packaging a local model puts around a one-line answer -- a code fence, a wrapping quote
// pair, a leading label. Named unwrapTitle rather than the module-private `unwrap` it was extracted
// from, which names nothing in a folder this size.

/** Strip a fence, a wrapping quote pair, a bullet, a heading, or a `Title:` label a local model adds. */
export function unwrapTitle(raw: string): string {
  let text = raw.trim();
  const fenced = /^```[a-z]*\n([\s\S]*?)\n?```$/i.exec(text);
  if (fenced?.[1] !== undefined) text = fenced[1].trim();
  // First non-empty line only: a model that ignored "one line" must not store a paragraph.
  text = (text.split(/\r?\n/).find((line) => line.trim() !== '') ?? '').trim();
  text = text.replace(/^([-*+]|#{1,6}|\d+[.)])\s+/, '').trim();
  text = text.replace(/^title\s*[:\-–]\s*/i, '').trim();
  const quoted = /^"([\s\S]*)"$/.exec(text) ?? /^'([\s\S]*)'$/.exec(text) ?? /^`([\s\S]*)`$/.exec(text);
  if (quoted?.[1] !== undefined) text = quoted[1].trim();
  return text.replace(/[.,;:]+$/, '').trim();
}
