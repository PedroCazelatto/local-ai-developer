// One member of a tar archive handed to Docker's putArchive. Directories carry no bytes and exist
// only so the extractor creates the parent chain of a file (write_file must scaffold src/foo/bar.ts
// into a fresh project); regular files carry their exact bytes.
//
// Its own module because no function owns it: encodeTar takes it as its parameter and SandboxClient
// builds it to call encodeTar, so it is the vocabulary the two ends of the transport share rather
// than the private shape of either.

/** One member of a tar archive handed to Docker's putArchive — a file with bytes, or a bare directory. */
export interface TarEntry {
  /** Path RELATIVE to the archive root, posix separators, no leading `./`. Dirs need no trailing `/`. */
  readonly path: string;
  /** 'file' writes `bytes`; 'directory' writes a zero-length header only. */
  readonly kind: 'file' | 'directory';
  /** Exact file bytes. Required for 'file', ignored for 'directory'. */
  readonly bytes?: Uint8Array;
}
