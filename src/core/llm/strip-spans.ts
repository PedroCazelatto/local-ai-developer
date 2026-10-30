// Cutting the recovered call spans out of the content the user sees. Overlap is tolerated rather than
// prevented: expandOverFence can widen one span into the previous one's territory, and clamping the
// cursor here is cheaper than making the producer reconcile them.

import type { Span } from './expand-over-fence.js';

/** Remove sorted (start, end) substrings from `text`, tolerating overlap. */
export function stripSpans(text: string, spans: Span[]): string {
  const parts: string[] = [];
  let cursor = 0;
  for (const [start, end] of spans) {
    parts.push(text.slice(cursor, Math.max(start, cursor)));
    cursor = Math.max(cursor, end);
  }
  parts.push(text.slice(cursor));
  return parts.join('');
}
