// The one place a missing Ollama metric becomes `null` rather than a number. It exists so the
// constitution's "token counts are always exact" rule has a single enforcement point: there is no
// branch here that can invent a count, so nothing downstream can be handed an estimate.

/**
 * An Ollama-reported count, or null when the field was absent. Preserves "0 tokens" vs "not
 * reported" — the two must never collapse, because a length-based guess is what they would collapse into.
 */
export function exactCount(value: number | undefined | null): number | null {
  return typeof value === 'number' ? value : null;
}
