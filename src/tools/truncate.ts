// Output truncation for tool results that flow into the model's window. A verbose `npm i` or a
// giant file dump would blow the num_ctx budget, so shell/container tools keep a head + tail and
// drop the middle. This truncates the MODEL-FACING result; the audit preview is truncated
// separately (V1/06), and the audit still never stores full output either.

/** Default cap for a single combined tool output fed back to the model. */
export const DEFAULT_OUTPUT_LIMIT = 20_000;

/**
 * If `text` exceeds `maxChars`, keep the first and last halves with a marker noting how much was
 * dropped; otherwise return it unchanged.
 */
export function truncateHeadTail(text: string, maxChars: number = DEFAULT_OUTPUT_LIMIT): string {
  if (text.length <= maxChars) return text;
  const half = Math.floor(maxChars / 2);
  const head = text.slice(0, half);
  const tail = text.slice(text.length - half);
  const omitted = text.length - head.length - tail.length;
  return `${head}\n...[truncated ${omitted} characters]...\n${tail}`;
}
