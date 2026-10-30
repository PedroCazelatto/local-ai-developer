// Defensive narrowing for vram-probes.json, which the user is invited to interfere with: the file's
// documented reset gesture is deleting it, so half-deleting it or hand-editing a row is well within
// what it will meet. A row of the wrong shape is DROPPED rather than trusted or thrown over, exactly
// as narrow-app-state.ts does for state.json.
//
// Dropping a row is a safe failure here in a way it would not be for the capability gate: a missing
// measurement shows as NO marker, so the worst a mangled file can do is under-inform the user. It can
// never mark a model too heavy that is not, and it can never refuse anything — the tag marks without
// refusing (#96a).

import { isRecord } from '../llm/is-record.js';
import type { VramMeasurement } from '../llm/vram-measurement.type.js';
import type { ProbeCache } from './probe-cache.type.js';

/**
 * Narrow a parsed JSON value to a ProbeCache, keeping only rows that carry two usable byte counts.
 * A row is usable when `weightsBytes` and `sizeVramBytes` are both finite, non-negative numbers —
 * anything else (a string, a null, NaN, a missing half) drops that row and keeps the rest, because one
 * bad row is no reason to discard every measurement beside it.
 */
export function narrowProbeCache(value: unknown): ProbeCache {
  // isRecord: a non-null, non-array object — so neither `null` nor a JSON array reaches the loop.
  if (!isRecord(value)) return {};
  const rows: Record<string, VramMeasurement> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!isRecord(raw)) continue;
    const weightsBytes = raw['weightsBytes'];
    const sizeVramBytes = raw['sizeVramBytes'];
    if (typeof weightsBytes !== 'number' || !Number.isFinite(weightsBytes) || weightsBytes < 0) {
      continue;
    }
    if (typeof sizeVramBytes !== 'number' || !Number.isFinite(sizeVramBytes) || sizeVramBytes < 0) {
      continue;
    }
    rows[key] = { weightsBytes, sizeVramBytes };
  }
  return rows;
}
