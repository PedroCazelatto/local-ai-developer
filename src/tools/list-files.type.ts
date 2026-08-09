// The vocabulary of one list_files call: the entries the container walk returns, and what came back
// from that walk. Shared by the lister, the ignore filter and the tree renderer so all three agree
// on what an entry is.

/** One filesystem entry, project-root-relative and posix-separated, with no leading `./`. */
export interface WorkspaceEntry {
  readonly path: string;
  /**
   * true only for a real directory. A SYMLINK is false even when it points at one — the walk never
   * follows links, so a link is reported as a leaf and its target is never enumerated.
   */
  readonly isDirectory: boolean;
}

/** The container walk's answer: the entries, or the model-facing reason there are none. */
export type WorkspaceListing =
  | { readonly ok: true; readonly entries: readonly WorkspaceEntry[] }
  | { readonly ok: false; readonly notFound: boolean; readonly message: string };
