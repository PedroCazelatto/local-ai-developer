// One node of the tree list_files prints. Folder vocabulary: emptyTreeNode builds them,
// orderTreeChildren sorts them and renderFileTree walks them — three peers speaking one word, so it
// belongs to none of them.
//
// `children` is a Map rather than an array because the tree is built by inserting paths segment by
// segment, and the builder has to ask "do I already have this segment?" once per segment per path.

/** One node of the indented listing tree: a name, what kind of entry it is, and its children by name. */
export interface TreeNode {
  readonly name: string;
  readonly isDirectory: boolean;
  readonly children: Map<string, TreeNode>;
}
