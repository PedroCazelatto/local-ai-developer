// The fixed field widths of the POSIX ustar format, shared by the WRITE half (encode-tar.ts and the
// header builders beside it) and the READ half (decode-tar-file.ts). Constants only, no function of
// its own: both halves read one declaration of each number rather than keeping copies that drift.

/** Header size, and the boundary every body is padded up to. The whole format is a multiple of it. */
export const BLOCK = 512;
/** ustar `name` field width. Anything longer must use `prefix` or a GNU long-name entry. */
export const NAME_MAX = 100;
/** ustar `prefix` field width. */
export const PREFIX_MAX = 155;
