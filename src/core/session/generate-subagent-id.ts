// Generate a short, stable, collision-free id for one in-memory sub-agent (V5/01). ULID-shaped: a
// millisecond timestamp encoded in Crockford base32 (10 chars) followed by 80 bits of CSPRNG
// randomness (16 chars) — 26 chars total, uppercase. Time-prefixed so the SHORT form (first few chars,
// shown in the `[sub:<short>]` history marker) increases with creation order; the FULL token is what
// the audit log records for lineage. No dependency — the repo hand-rolls its ids (SessionMemory uses
// per-file sequential ids); this only needs uniqueness within a session, not global sortability.

import { randomBytes } from 'node:crypto';

/** Crockford base32 alphabet (omits I, L, O, U so the short id is unambiguous when read aloud). */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Map an already-in-range (0..31) index to its Crockford digit; `?? '0'` satisfies noUncheckedIndexedAccess. */
function digitAt(index: number): string {
  return CROCKFORD[index] ?? '0';
}

/** A 26-char ULID-shaped id: 10 timestamp chars + 16 random chars. */
export function generateSubagentId(): string {
  let ts = Date.now();
  let time = '';
  // Big-endian: peel low 5 bits (`% 32` is exact for ms-since-epoch, well under Number.MAX_SAFE_INTEGER).
  for (let i = 0; i < 10; i += 1) {
    time = digitAt(ts % 32) + time;
    ts = Math.floor(ts / 32);
  }
  let rand = '';
  for (const byte of randomBytes(16)) {
    rand += digitAt(byte % 32); // 0..255 → 0..31 uniform (32 divides 256)
  }
  return time + rand;
}
