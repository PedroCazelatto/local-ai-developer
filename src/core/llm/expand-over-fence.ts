// Widening a recovered call's span so the markdown fence the model wrapped it in is stripped with it.
// Recovering the call but leaving ```json … ``` behind would put an empty code block in the visible
// reply, which reads as a rendering bug rather than as a tool call that was lifted out.

// A markdown fence opener (``` + optional language) immediately before a recovered call, so we
// can swallow the fence together with the call when cleaning the content.
const FENCE_BEFORE = /```[A-Za-z0-9_+.-]*[ \t]*(?:\r?\n[ \t]*)?$/;
const WHITESPACE = ' \t\r\n';

/**
 * A half-open [start, end) character range of the raw content. Produced here — this is the only place
 * a span is constructed — and consumed by strip-spans.ts, which cuts them out of the content.
 */
export type Span = readonly [start: number, end: number];

/** Widen a span to also cover a wrapping ```json … ``` fence, so stripping leaves no fence debris. */
export function expandOverFence(content: string, start: number, end: number): Span {
  const opener = FENCE_BEFORE.exec(content.slice(0, start));
  if (opener === null || opener.index + opener[0].length !== start) {
    return [start, end];
  }
  let j = end;
  while (j < content.length && WHITESPACE.includes(content[j] ?? '')) {
    j += 1;
  }
  if (content.startsWith('```', j)) {
    return [opener.index, j + 3];
  }
  if (j >= content.length) {
    // fence never closed (stream ended) — eat the opener anyway
    return [opener.index, j];
  }
  return [start, end];
}
