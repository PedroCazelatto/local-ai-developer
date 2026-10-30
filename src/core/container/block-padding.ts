// The zero bytes that carry a tar body up to the next block boundary, so the header after it starts
// where the reader expects (encode-tar.ts pushes one of these after every body it writes).

import { BLOCK } from './tar-format.js';

/** Pad `length` bytes up to the next 512-byte boundary. */
export function blockPadding(length: number): Uint8Array {
  const remainder = length % BLOCK;
  return new Uint8Array(remainder === 0 ? 0 : BLOCK - remainder);
}
