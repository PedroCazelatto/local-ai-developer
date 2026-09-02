// Read `size_vram` off a raw `/api/ps` row, and answer "unknown" rather than a number when it is not
// really there.
//
// THE PINNED PACKAGE DECLARES THIS FIELD AND STILL CANNOT BE TRUSTED FOR IT, which is a different
// situation from read-capabilities.ts and worth stating so nobody "simplifies" this away. `ollama`
// 0.5.18 puts `size_vram: number` on `ModelResponse` — the ONE row type it uses for both `/api/tags`
// and `/api/ps`. Driven against the live daemon: `/api/tags` rows come back with `size_vram`
// **undefined**, while `/api/ps` rows carry a real number. So the declared type is a lie on one of the
// two endpoints it covers, and a plain field read would hand `undefined` to arithmetic that TypeScript
// had promised was safe. Checking is the honest shape; `unknown` in, checked number out.
//
// Unknown is NOT the same as zero, and conflating them would invent a verdict. Zero VRAM would mean
// every weight byte is on the CPU — the strongest possible "too heavy" — whereas an unreadable field
// means nothing was measured at all. The `too heavy` tag marks without refusing, so the safe direction
// here is the opposite of the capability gate's: an unknown model gets NO marker, because a marker is
// a claim and there is nothing to claim.

import { isRecord } from './is-record.js';

/**
 * The `size_vram` bytes a raw `/api/ps` row reports, or undefined when the row cannot supply one —
 * absent, null, not a number, NaN/Infinity, or negative. `row` is `unknown` because the daemon's row
 * shape is only partly what the pinned package declares (see the header).
 */
export function readSizeVram(row: unknown): number | undefined {
  const raw: unknown = isRecord(row) ? row['size_vram'] : undefined;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return undefined;
  return raw;
}
