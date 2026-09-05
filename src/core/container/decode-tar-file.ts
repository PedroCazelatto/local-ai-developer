// Read the FIRST regular member out of a tar archive — the READ half of the file tools' container
// transport. Docker's getArchive answers a single-path request with a one-entry tar, so "first
// member" is the file that was asked for; a directory request answers with its own header first,
// which is why the directory case is reported rather than skipped past.
//
// Metadata-only members are walked over on the way: GNU long-name ('L') and PAX ('x'/'g') entries
// describe the member that FOLLOWS them, and Go's archive/tar writer emits them for long paths.
// Their bodies are not needed here — the caller already knows which path it asked for.

import { paddedLength } from './padded-length.js';
import { readOctal } from './read-octal.js';
import { BLOCK } from './tar-format.js';

/** Members that describe the NEXT header rather than carrying content of their own. */
const METADATA_TYPEFLAGS = new Set(['L', 'K', 'x', 'g']);

// What the first member of a getArchive tar turned out to be. read_file needs the distinction:
// asking for a directory is a different model-facing error from asking for a file that is not there.
export type TarFileRead =
  | { readonly kind: 'file'; readonly bytes: Uint8Array }
  | { readonly kind: 'directory' }
  | { readonly kind: 'empty' };

export function decodeTarFile(archive: Buffer): TarFileRead {
  let offset = 0;
  while (offset + BLOCK <= archive.length) {
    const header = archive.subarray(offset, offset + BLOCK);
    if (header.every((byte) => byte === 0)) return { kind: 'empty' }; // terminating zero block

    // readOctal parses one NUL/space-terminated octal header field; paddedLength rounds a body length up
    // to the block boundary the next header starts on.
    const size = readOctal(header, 124, 12);
    const typeflag = String.fromCharCode(header[156] ?? 0);
    const bodyStart = offset + BLOCK;

    if (METADATA_TYPEFLAGS.has(typeflag)) {
      offset = bodyStart + paddedLength(size);
      continue;
    }
    if (typeflag === '5') return { kind: 'directory' };
    // '0' is a regular file; a NUL typeflag is the pre-ustar spelling of the same thing.
    if (typeflag === '0' || typeflag === '\0') {
      return { kind: 'file', bytes: archive.subarray(bodyStart, bodyStart + size) };
    }
    // A symlink ('2'), hardlink ('1'), device or fifo — not a readable file. Docker never answers a
    // file request with one of these (it dereferences), so treat it as nothing found.
    return { kind: 'empty' };
  }
  return { kind: 'empty' };
}
