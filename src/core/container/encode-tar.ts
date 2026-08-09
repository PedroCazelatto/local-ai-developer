// Build a POSIX ustar archive in memory, for Docker's putArchive. This is the WRITE half of the
// file tools' container transport: bytes cross into /workspace as a tar stream rather than as a
// shell command, so no content is ever interpolated into `sh -c` and no quoting rule stands between
// the model's file and the disk.
//
// ustar, not GNU: a 512-byte header per entry, values in NUL-terminated octal, a checksum over the
// header with its own checksum field read as spaces. Names longer than 100 bytes use the ustar
// `prefix` field (split at a `/`); the rare name that will not split that way falls back to a GNU
// long-name ('L') entry, which Docker's Go extractor also understands.

import type { TarEntry } from './tar-entry.type.js';

const BLOCK = 512;
/** ustar `name` field width. Anything longer must use `prefix` or a GNU long-name entry. */
const NAME_MAX = 100;
/** ustar `prefix` field width. */
const PREFIX_MAX = 155;
/**
 * The sandbox runs rootless as the image's `node` user (uid/gid 1000 — docker-compose.yml, `user:
 * node`). Extracting as that same owner is what keeps a written file editable by the shell tools;
 * anything else would land root-owned and the next execute_command could not touch it.
 */
const OWNER_ID = 1000;
const OWNER_NAME = 'node';

/** Write `value` as NUL-terminated octal, right-aligned in `width` bytes — the ustar number format. */
function writeOctal(header: Uint8Array, offset: number, width: number, value: number): void {
  const digits = value.toString(8).padStart(width - 1, '0');
  for (let i = 0; i < width - 1; i += 1) {
    header[offset + i] = digits.charCodeAt(i);
  }
  header[offset + width - 1] = 0;
}

/** Write `value` as ASCII into `width` bytes, NUL-padded (truncating is not possible — callers pre-check). */
function writeAscii(header: Uint8Array, offset: number, width: number, value: string): void {
  const bytes = Buffer.from(value, 'utf-8');
  for (let i = 0; i < width && i < bytes.length; i += 1) {
    header[offset + i] = bytes[i] ?? 0;
  }
}

/**
 * Split `path` into the ustar `prefix`/`name` pair, or null when no `/` boundary yields two pieces
 * that fit. Longest possible prefix wins, so `name` stays as short as it can.
 */
function splitUstarName(path: string): { readonly prefix: string; readonly name: string } | null {
  if (Buffer.byteLength(path) <= NAME_MAX) return { prefix: '', name: path };
  for (let cut = path.lastIndexOf('/'); cut > 0; cut = path.lastIndexOf('/', cut - 1)) {
    const prefix = path.slice(0, cut);
    const name = path.slice(cut + 1);
    if (Buffer.byteLength(prefix) <= PREFIX_MAX && Buffer.byteLength(name) <= NAME_MAX) {
      return { prefix, name };
    }
  }
  return null;
}

/**
 * One 512-byte header. `typeflag` is '0' (regular file), '5' (directory) or 'L' (GNU long name).
 * The checksum is computed last, over a header whose own checksum field reads as eight spaces.
 */
function buildHeader(name: string, prefix: string, size: number, mode: number, typeflag: string, mtime: number): Uint8Array {
  const header = new Uint8Array(BLOCK);
  writeAscii(header, 0, NAME_MAX, name);
  writeOctal(header, 100, 8, mode);
  writeOctal(header, 108, 8, OWNER_ID);
  writeOctal(header, 116, 8, OWNER_ID);
  writeOctal(header, 124, 12, size);
  writeOctal(header, 136, 12, mtime);
  header.fill(0x20, 148, 156); // checksum field reads as spaces while the checksum is summed
  header[156] = typeflag.charCodeAt(0);
  writeAscii(header, 257, 6, 'ustar');
  writeAscii(header, 263, 2, '00');
  writeAscii(header, 265, 32, OWNER_NAME);
  writeAscii(header, 297, 32, OWNER_NAME);
  writeAscii(header, 345, PREFIX_MAX, prefix);

  let checksum = 0;
  for (const byte of header) checksum += byte;
  writeOctal(header, 148, 7, checksum); // 6 octal digits + NUL, then a trailing space
  header[155] = 0x20;
  return header;
}

/** Pad `length` bytes up to the next 512-byte boundary. */
function padding(length: number): Uint8Array {
  const remainder = length % BLOCK;
  return new Uint8Array(remainder === 0 ? 0 : BLOCK - remainder);
}

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

    const split = splitUstarName(path);
    if (split === null) {
      // No `/` boundary splits this name into prefix+name — emit the GNU long-name entry first, whose
      // BODY is the real path, then a header carrying a truncated name the extractor will override.
      const nameBytes = Buffer.from(`${path}\0`, 'utf-8');
      blocks.push(buildHeader('././@LongLink', '', nameBytes.length, 0o644, 'L', mtime));
      blocks.push(nameBytes, padding(nameBytes.length));
      blocks.push(buildHeader(path.slice(0, NAME_MAX), '', bytes.length, isDir ? 0o755 : 0o644, isDir ? '5' : '0', mtime));
    } else {
      blocks.push(buildHeader(split.name, split.prefix, bytes.length, isDir ? 0o755 : 0o644, isDir ? '5' : '0', mtime));
    }

    if (!isDir) {
      blocks.push(bytes, padding(bytes.length));
    }
  }

  blocks.push(new Uint8Array(BLOCK * 2)); // two zero blocks terminate the archive
  return Buffer.concat(blocks);
}
