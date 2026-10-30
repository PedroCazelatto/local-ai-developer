// The read counterpart of write-octal.ts: one numeric ustar header field, back out as a number
// (decode-tar-file.ts reads a member's size with it).

/** Read a NUL/space-terminated octal field. Returns 0 for an all-NUL (absent) field. */
export function readOctal(buffer: Buffer, offset: number, width: number): number {
  const raw = buffer.subarray(offset, offset + width).toString('latin1');
  const digits = raw.replace(/[\0 ]/g, '');
  if (digits === '') return 0;
  const value = Number.parseInt(digits, 8);
  return Number.isNaN(value) ? 0 : value;
}
