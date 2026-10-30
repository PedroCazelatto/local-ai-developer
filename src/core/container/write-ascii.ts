// One text ustar header field — name, prefix, magic, version and the owner names (build-tar-header.ts).

/** Write `value` as ASCII into `width` bytes, NUL-padded (truncating is not possible — callers pre-check). */
export function writeAscii(header: Uint8Array, offset: number, width: number, value: string): void {
  const bytes = Buffer.from(value, 'utf-8');
  for (let i = 0; i < width && i < bytes.length; i += 1) {
    header[offset + i] = bytes[i] ?? 0;
  }
}
