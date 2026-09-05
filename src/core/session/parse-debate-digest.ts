// Parse the distiller's UNTRUSTED reply into a DebateDigest. The distiller is the same local model as
// everything else, so its output is validated, never believed: the object must carry a real boolean
// verdict, and anything that is not a usable string is dropped from the two lists.
//
// Returns null rather than a partial digest. `survived` is the one field that cannot be defaulted — a
// missing verdict is the whole answer missing, and inventing one would be exactly the guess the
// constitution forbids. The caller re-prompts once on null, then surfaces a recoverable tool error.

import type { DebateDigest } from './debate-digest.type.js';
import { digestLine } from './digest-line.js';
import { digestLineList } from './digest-line-list.js';
import { extractDebateObject } from './extract-debate-object.js';
import { looseBoolean } from './loose-boolean.js';

/**
 * Decode `raw` into a digest, or null when it carries no usable verdict. Tolerates the packaging a
 * local model adds around JSON (a ```json fence, a "Here is the digest:" preamble, trailing prose) by
 * falling back to the first braced span in the text.
 */
export function parseDebateDigest(raw: string): DebateDigest | null {
  // extractDebateObject: the first JSON object in the reply, fence and preamble tolerated.
  const object = extractDebateObject(raw);
  if (object === null) return null;
  // looseBoolean: a real boolean or the quoted "true"/"false"; null for anything else.
  const survived = looseBoolean(object['survived']);
  if (survived === null) return null; // no verdict ⇒ no digest; never defaulted to true or false
  return {
    survived,
    standingObjections: digestLineList(object['standing_objections']),
    heldUp: digestLineList(object['held_up']),
    revise: digestLine(object['revise']) ?? '',
  };
}
