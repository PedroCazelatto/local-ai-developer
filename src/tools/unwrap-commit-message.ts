// Strip the packaging a local model wraps its commit message in — a code fence, or a quote pair
// around the whole message — leaving the bare message.
//
// It is NOT core/session/unwrap-title.ts, though the first two lines are the same, and this is the
// distinction the two names exist to keep: unwrapTitle takes the FIRST NON-EMPTY LINE and throws the
// rest away, plus bullets, headings, a `Title:` label and trailing punctuation. A commit message has
// a BODY. Running a title unwrapper over one would silently discard everything after the subject.
//
// Both were called `unwrap` while they were private, in different folders. Neither kept the name.

/** Drop fences/quotes/preamble a local model wraps its answer in, leaving the bare message. */
export function unwrapCommitMessage(raw: string): string {
  let text = raw.trim();
  // A fenced block (```/```text/```git) — take its contents.
  const fenced = /^```[a-z]*\n([\s\S]*?)\n?```$/i.exec(text);
  if (fenced?.[1] !== undefined) text = fenced[1].trim();
  // A whole-message wrapping quote pair.
  const quoted = /^"([\s\S]*)"$/.exec(text) ?? /^'([\s\S]*)'$/.exec(text);
  if (quoted?.[1] !== undefined) text = quoted[1].trim();
  return text;
}
