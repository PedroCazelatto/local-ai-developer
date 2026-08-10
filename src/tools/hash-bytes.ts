// sha256 of a byte buffer, hex. The read tracker's identity for "the file still says what it said".
//
// A hash rather than an mtime because both write tools already hold the file's bytes when they need
// the answer — edit_file reads before it splices, write_file reads to tell a create from an overwrite
// — so comparing content costs no container round-trip, while a stat would cost one. It is also the
// more exact of the two: a git checkout that rewrites a file to identical bytes moves its mtime and
// changes nothing the model read, and a staleness check that fires there teaches the model to
// distrust a guard that was right.

import { createHash } from 'node:crypto';

/** Hex sha256 digest of `bytes`. */
export function hashBytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}
