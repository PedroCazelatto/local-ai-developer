// The first JSON object in an UNTRUSTED distiller reply.
//
// Tolerates the packaging a local model adds around JSON — a ```json fence, a "Here is the digest:"
// preamble, trailing prose — by falling back to the first braced span in the text. That fallback is
// why this is a separate step from validating the fields: getting an object out and deciding whether
// its contents are usable are two different judgements.
//
// Named extractDebateObject rather than the module-private `extractObject` it was extracted from.

import { isRecord } from '../llm/is-record.js';
import { loadsOrRepair } from '../llm/loads-or-repair.js';

/** The first JSON object in the reply, as a plain record; null when there is none. */
export function extractDebateObject(raw: string): Record<string, unknown> | null {
  // loadsOrRepair: JSON.parse with the local-model repair pass (literal newlines inside strings).
  const direct = loadsOrRepair(raw.trim());
  // isRecord: a non-null, non-array object — the shared narrowing from core/llm.
  if (isRecord(direct)) return direct;
  // Fall back to the first braced span, which survives a fence, a preamble, or trailing prose.
  const span = /\{[\s\S]*\}/.exec(raw);
  const whole = span?.[0];
  if (whole === undefined) return null;
  const extracted = loadsOrRepair(whole);
  return isRecord(extracted) ? extracted : null;
}
