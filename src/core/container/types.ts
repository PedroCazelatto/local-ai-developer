// The vocabulary core/container/ speaks about moving BYTES across the container boundary. No single
// function owns these: TarEntry is written by encode-tar.ts and built by SandboxClient, and the two
// SandboxWrite/SandboxRead results are returned by SandboxClient and read by the file tools — so
// they live with the folder rather than inside one arbitrary function's file.

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

// Results of the sandbox's file transport. RECOVERABLE like ExecResult: a missing file, a stopped
// container or a daemon error comes back as a value, never a throw — the file tools turn each into
// the structured error the model reads and retries from, and a thrown error would kill the turn.

export type SandboxRead =
  | { readonly ok: true; readonly kind: 'file'; readonly bytes: Uint8Array }
  | { readonly ok: true; readonly kind: 'directory' }
  /** `notFound` separates "no such path" (the model's typo) from a daemon/container failure. */
  | { readonly ok: false; readonly notFound: boolean; readonly message: string };

export type SandboxWrite = { readonly ok: true } | { readonly ok: false; readonly message: string };
