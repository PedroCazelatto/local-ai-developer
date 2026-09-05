// The first required parameter the model left out, or null when all are present.
//
// Only ABSENCE is checked here. Type-correctness of a field that IS present is left to the tool, which
// owns its own verbatim error strings (V1/03) -- so the model gets one voice per problem rather than a
// generic complaint from the dispatcher and a specific one from the tool.

import type { JSONSchema } from '../../tools/types.js';

/** First required parameter that is absent, or null if all are present. */
export function firstMissingRequired(schema: JSONSchema, args: Record<string, unknown>): string | null {
  for (const field of schema.required ?? []) {
    if (args[field] === undefined) return field;
  }
  return null;
}
