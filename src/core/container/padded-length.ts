// How far past a tar body the next header sits. The read-side counterpart of block-padding.ts: that one
// produces the pad bytes, this one only measures them, because a reader skips rather than writes.

import { BLOCK } from './tar-format.js';

/** Round `length` up to the next 512-byte boundary — how far past a body the next header sits. */
export function paddedLength(length: number): number {
  return Math.ceil(length / BLOCK) * BLOCK;
}
