// The capability GATE: can this model run any phase of this product at all?
//
// Every phase here is a tool-calling loop, so a model without `tools` is not "worse", it is
// structurally incapable — a Worker that cannot call `edit_file` does nothing and burns its five
// rounds looking confused. That is why the answer is a refusal rather than a warning, and why the
// "too heavy" tag (which marks without refusing) is a different question with a different answer.

/**
 * Whether a model's reported capabilities include tool calling. The list comes from `/api/tags` via
 * readCapabilities, which yields `[]` for a daemon that reports nothing — so an unknown model is an
 * incapable one, which is the fail-closed direction (OPEN-QUESTIONS.md #13).
 */
export function supportsTools(capabilities: readonly string[]): boolean {
  return capabilities.includes('tools');
}
