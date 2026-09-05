// Best-effort extraction of a JSON array out of a local model's reply.
//
// The same shape core/session/extract-debate-object.ts takes for an OBJECT: try the whole reply
// first, then fall back to the first bracketed span, because a model that was asked for JSON and
// answered with a ```json fence or a "Here are the matches:" preamble has still answered.
//
// It never throws and never returns a partial: anything unusable is an EMPTY array, which for
// search_rules is a legitimate answer ("nothing matches") and is what keeps a malformed reply from
// killing the turn.

import { loadsOrRepair } from '../core/llm/loads-or-repair.js';

/** Best-effort extraction of a JSON array from the reply (tolerates code fences / stray prose). */
export function extractJsonArray(content: string): unknown[] {
  const direct = loadsOrRepair(content.trim());
  if (Array.isArray(direct)) return direct;
  // Fall back to the first bracketed span if the model wrapped the array in fences or prose.
  const span = /\[[\s\S]*\]/.exec(content);
  const whole = span?.[0];
  if (whole !== undefined) {
    const extracted = loadsOrRepair(whole);
    if (Array.isArray(extracted)) return extracted;
  }
  return [];
}
