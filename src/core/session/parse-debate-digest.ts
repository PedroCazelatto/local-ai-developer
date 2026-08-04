// Parse the distiller's UNTRUSTED reply into a DebateDigest. The distiller is the same local model as
// everything else, so its output is validated, never believed: the object must carry a real boolean
// verdict, and anything that is not a usable string is dropped from the two lists.
//
// Returns null rather than a partial digest. `survived` is the one field that cannot be defaulted — a
// missing verdict is the whole answer missing, and inventing one would be exactly the guess the
// constitution forbids. The caller re-prompts once on null, then surfaces a recoverable tool error.

import { loadsOrRepair } from '../llm/index.js';
import type { DebateDigest } from './run-debate.type.js';

/** Cap one digest line, so a distiller that ignored "25 words" cannot hand the caller a paragraph. */
const LINE_LIMIT = 200;

/** How many entries either list may carry — a debate this small cannot honestly produce more. */
const LIST_LIMIT = 5;

/**
 * Decode `raw` into a digest, or null when it carries no usable verdict. Tolerates the packaging a
 * local model adds around JSON (a ```json fence, a "Here is the digest:" preamble, trailing prose) by
 * falling back to the first braced span in the text.
 */
export function parseDebateDigest(raw: string): DebateDigest | null {
  const object = extractObject(raw);
  if (object === null) return null;
  const survived = asBoolean(object['survived']);
  if (survived === null) return null; // no verdict ⇒ no digest; never defaulted to true or false
  return {
    survived,
    standingObjections: asLines(object['standing_objections']),
    heldUp: asLines(object['held_up']),
    revise: asLine(object['revise']) ?? '',
  };
}

/** The first JSON object in the reply, as a plain record; null when there is none. */
function extractObject(raw: string): Record<string, unknown> | null {
  // loadsOrRepair: JSON.parse with the local-model repair pass (literal newlines inside strings).
  const direct = loadsOrRepair(raw.trim());
  if (isRecord(direct)) return direct;
  // Fall back to the first braced span, which survives a fence, a preamble, or trailing prose.
  const span = /\{[\s\S]*\}/.exec(raw);
  const whole = span?.[0];
  if (whole === undefined) return null;
  const extracted = loadsOrRepair(whole);
  return isRecord(extracted) ? extracted : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A real JSON boolean, or the strings "true"/"false" — a local model writes the verdict quoted often
 * enough that rejecting it would throw away a digest whose meaning is unambiguous. Anything else
 * (a number, "yes", "partly", absent) is null: that is a verdict this code refuses to interpret.
 */
function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return null;
  const text = value.trim().toLowerCase();
  if (text === 'true') return true;
  if (text === 'false') return false;
  return null;
}

/** One list entry / the `revise` line: a non-empty single line, capped. Null when unusable. */
function asLine(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  // Collapse any newline a model wrote inside a "one line" string, so a row can never break the layout.
  const text = value.replace(/\s*\r?\n\s*/g, ' ').trim();
  if (text === '') return null;
  return text.length <= LINE_LIMIT ? text : `${text.slice(0, LINE_LIMIT).trimEnd()}…`;
}

/**
 * A list of digest lines. A single string is accepted as a one-entry list (a common local-model
 * shape); anything that is not an array or a string yields []. Unusable entries are dropped rather
 * than turning the whole digest into a failure — the verdict is still readable without them.
 */
function asLines(value: unknown): readonly string[] {
  const items = Array.isArray(value) ? value : [value];
  const lines: string[] = [];
  for (const item of items) {
    const line = asLine(item);
    if (line !== null && !lines.includes(line)) lines.push(line);
    if (lines.length === LIST_LIMIT) break;
  }
  return lines;
}
