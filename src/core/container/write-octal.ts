// One numeric ustar header field. The format stores numbers as ASCII octal digits, NUL-terminated —
// size, mode, mtime, uid/gid and the checksum all go through here (build-tar-header.ts).

/** Write `value` as NUL-terminated octal, right-aligned in `width` bytes — the ustar number format. */
export function writeOctal(header: Uint8Array, offset: number, width: number, value: number): void {
  const digits = value.toString(8).padStart(width - 1, '0');
  for (let i = 0; i < width - 1; i += 1) {
    header[offset + i] = digits.charCodeAt(i);
  }
  header[offset + width - 1] = 0;
}
