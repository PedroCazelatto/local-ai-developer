// What the first member of a getArchive tar turned out to be. read_file needs the distinction:
// asking for a directory is a different model-facing error from asking for a file that is not there.

export type TarFileRead =
  | { readonly kind: 'file'; readonly bytes: Uint8Array }
  | { readonly kind: 'directory' }
  | { readonly kind: 'empty' };
