// One filesystem entry as the container walk reports it. Folder vocabulary: listWorkspaceEntries
// produces them, buildIgnoreFilter decides which are hidden, and renderFileTree arranges them --
// three peers speaking one word, so it belongs to none of them.

/** One filesystem entry, project-root-relative and posix-separated, with no leading `./`. */
export interface WorkspaceEntry {
  readonly path: string;
  /**
   * true only for a real directory. A SYMLINK is false even when it points at one — the walk never
   * follows links, so a link is reported as a leaf and its target is never enumerated.
   */
  readonly isDirectory: boolean;
}
