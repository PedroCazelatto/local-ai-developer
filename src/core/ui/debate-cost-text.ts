// What a debate cost, as it reads on the closing line render-debate-summary.ts prints.
//
// The figure is the EXACT summed Ollama count and is printed in full (`3,412 tokens`), never rounded
// to a friendlier `3.4k` (constitution: token counts are always exact). A metric Ollama omitted on any
// call in the debate makes the whole total unknown, and an unknown total is stated as such rather than
// shown as a zero or a partial sum.

/** The exact total, or "tokens not reported" when Ollama omitted a metric on any call in the debate. */
export function debateCostText(promptTokens: number | null, evalTokens: number | null): string {
  if (promptTokens === null || evalTokens === null) return 'tokens not reported';
  return `${(promptTokens + evalTokens).toLocaleString('en-US')} tokens`;
}
