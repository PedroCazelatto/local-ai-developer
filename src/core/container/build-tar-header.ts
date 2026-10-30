// One 512-byte ustar header — the whole of the format's structure lives here. Values are written in
// NUL-terminated octal (write-octal.ts) or ASCII (write-ascii.ts) at fixed offsets, and the checksum
// is a plain byte sum over the finished header with its own checksum field read as spaces.

import { writeAscii } from './write-ascii.js';
import { writeOctal } from './write-octal.js';
import { BLOCK, NAME_MAX, PREFIX_MAX } from './tar-format.js';

/**
 * The sandbox runs rootless as the image's `node` user (uid/gid 1000 — docker-compose.yml, `user:
 * node`). Extracting as that same owner is what keeps a written file editable by the shell tools;
 * anything else would land root-owned and the next execute_command could not touch it.
 */
const OWNER_ID = 1000;
const OWNER_NAME = 'node';

/**
 * One 512-byte header. `typeflag` is '0' (regular file), '5' (directory) or 'L' (GNU long name).
 * The checksum is computed last, over a header whose own checksum field reads as eight spaces.
 */
export function buildTarHeader(name: string, prefix: string, size: number, mode: number, typeflag: string, mtime: number): Uint8Array {
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
