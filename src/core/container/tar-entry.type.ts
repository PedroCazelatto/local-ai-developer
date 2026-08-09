// One member of a tar archive handed to Docker's putArchive. Directories carry no bytes and exist
// only so the extractor creates the parent chain of a file (write_file must scaffold src/foo/bar.ts
// into a fresh project); regular files carry their exact bytes.

export interface TarEntry {
  /** Path RELATIVE to the archive root, posix separators, no leading `./`. Dirs need no trailing `/`. */
  readonly path: string;
  /** 'file' writes `bytes`; 'directory' writes a zero-length header only. */
  readonly kind: 'file' | 'directory';
  /** Exact file bytes. Required for 'file', ignored for 'directory'. */
  readonly bytes?: Uint8Array;
}
