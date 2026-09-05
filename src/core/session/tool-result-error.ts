// The `error` string a structured tool payload carries, if it carries one -- what exit_status and the
// audit row's error field are derived from when the tool did not set them explicitly.
//
// Named toolResultError rather than the module-private `errorOf` it was extracted from.

import type { JsonObject } from '../../tools/types.js';

/** The `error` string of a structured payload, if it carries one (for deriving exit_status/error). */
export function toolResultError(content: string | JsonObject): string | null {
  if (typeof content === 'object' && content !== null) {
    const value = content['error'];
    if (typeof value === 'string') return value;
  }
  return null;
}
