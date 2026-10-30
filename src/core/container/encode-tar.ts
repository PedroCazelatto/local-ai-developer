// Build a POSIX ustar archive in memory, for Docker's putArchive. This is the WRITE half of the
// file tools' container transport: bytes cross into /workspace as a tar stream rather than as a
// shell command, so no content is ever interpolated into `sh -c` and no quoting rule stands between
// the model's file and the disk.
//
// ustar, not GNU: a 512-byte header per entry (build-tar-header.ts), values in NUL-terminated octal.
// Names longer than 100 bytes use the ustar `prefix` field (split-ustar-name.ts); the rare name that
// will not split that way falls back to a GNU long-name ('L') entry, which Docker's Go extractor
// also understands.

import { buildTarHeader } from './build-tar-header.js';
import { blockPadding } from './block-padding.js';
import { splitUstarName } from './split-ustar-name.js';
import { BLOCK, NAME_MAX } from './tar-format.js';
import type { TarEntry } from './tar-entry.type.js';

/**
 * Encode `entries` as a tar archive. Entry order is the caller's: putArchive extracts in order, so
 * a file's parent directories must be listed before it.
 */
export function encodeTar(entries: readonly TarEntry[]): Buffer {
  const mtime = Math.floor(Date.now() / 1000);
  const blocks: Uint8Array[] = [];

  for (const entry of entries) {
    const isDir = entry.kind === 'directory';
    const path = isDir ? `${entry.path.replace(/\/+$/, '')}/` : entry.path;
    const bytes = isDir ? new Uint8Array(0) : (entry.bytes ?? new Uint8Array(0));

    // splitUstarName returns the prefix/name pair the 100-byte `name` field needs, or null when no
    // `/` boundary splits the path into two pieces that fit.
    const split = splitUstarName(path);
    if (split === null) {
      // No `/` boundary splits this name into prefix+name — emit the GNU long-name entry first, whose
      // BODY is the real path, then a header carrying a truncated name the extractor will override.
      const nameBytes = Buffer.from(`${path}\0`, 'utf-8');
      // buildTarHeader lays out one 512-byte ustar header, checksum included; blockPadding() carries a body
      // up to the next block boundary so the header after it starts where the reader expects.
      blocks.push(buildTarHeader('././@LongLink', '', nameBytes.length, 0o644, 'L', mtime));
      blocks.push(nameBytes, blockPadding(nameBytes.length));
      blocks.push(buildTarHeader(path.slice(0, NAME_MAX), '', bytes.length, isDir ? 0o755 : 0o644, isDir ? '5' : '0', mtime));
    } else {
      blocks.push(buildTarHeader(split.name, split.prefix, bytes.length, isDir ? 0o755 : 0o644, isDir ? '5' : '0', mtime));
    }

    if (!isDir) {
      blocks.push(bytes, blockPadding(bytes.length));
    }
  }

  blocks.push(new Uint8Array(BLOCK * 2)); // two zero blocks terminate the archive
  return Buffer.concat(blocks);
}
