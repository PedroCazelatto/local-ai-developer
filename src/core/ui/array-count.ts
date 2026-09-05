// How many entries a model-supplied array argument holds — for the tool calls whose subject is a
// count rather than a value (`ask_user 3 questions`).
//
// A non-array reads as 0 rather than throwing: nothing in the tool-call record validates, and the
// dispatcher is what turns a bad call into an error the model can read.

/** How many entries an array argument holds; 0 when it is not an array. */
export function arrayCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}
