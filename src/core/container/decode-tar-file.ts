// Read the FIRST regular member out of a tar archive — the READ half of the file tools' container
// transport. Docker's getArchive answers a single-path request with a one-entry tar, so "first
// member" is the file that was asked for; a directory request answers with its own header first,
// which is why the directory case is reported rather than skipped past.
//
// Metadata-only members are walked over on the way: GNU long-name ('L') and PAX ('x'/'g') entries
// describe the member that FOLLOWS them, and Go's archive/tar writer emits them for long paths.
// Their bodies are not needed here — the caller already knows which path it asked for.

import type { TarFileRead } from './decode-tar-file.type.js';

const BLOCK = 512;
/** Members that describe the NEXT header rather than carrying content of their own. */
const METADATA_TYPEFLAGS = new Set(['L', 'K', 'x', 'g']);

/** Read a NUL/space-terminated octal field. Returns 0 for an all-NUL (absent) field. */
function readOctal(buffer: Buffer, offset: number, width: number): number {
  const raw = buffer.subarray(offset, offset + width).toString('latin1');
  const digits = raw.replace(/[\0 ]/g, '');
  if (digits === '') return 0;
  const value = Number.parseInt(digits, 8);
  return Number.isNaN(value) ? 0 : value;
}

/** Round `length` up to the next 512-byte boundary — how far past a body the next header sits. */
function padded(length: number): number {
  return Math.ceil(length / BLOCK) * BLOCK;
}

export function decodeTarFile(archive: Buffer): TarFileRead {
  let offset = 0;
  while (offset + BLOCK <= archive.length) {
    const header = archive.subarray(offset, offset + BLOCK);
    if (header.every((byte) => byte === 0)) return { kind: 'empty' }; // terminating zero block

    const size = readOctal(header, 124, 12);
    const typeflag = String.fromCharCode(header[156] ?? 0);
    const bodyStart = offset + BLOCK;

    if (METADATA_TYPEFLAGS.has(typeflag)) {
      offset = bodyStart + padded(size);
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
