// The address form the UI and the model use for a context — its leading UUID characters, as in
// `design/7a888b1f`. The length lives here with the function that applies it.

/** How many leading UUID characters address a context in the UI and to the model (`design/7a888b1f`). */
export const CONTEXT_SHORT_ID_LEN = 8;

/** The address form the UI and the model use for a context — its leading UUID characters. */
export function shortContextId(contextId: string): string {
  return contextId.slice(0, CONTEXT_SHORT_ID_LEN);
}
