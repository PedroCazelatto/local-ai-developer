// A fresh, childless node of list_files' listing tree.
//
// `emptyTreeNode` rather than `emptyNode`: as a file name in a flat directory, "node" is the runtime
// this whole project runs on before it is anything to do with a tree.

import type { TreeNode } from './tree-node.type.js';

/** A childless tree node — the root, and every segment as the builder first meets it. */
export function emptyTreeNode(name: string, isDirectory: boolean): TreeNode {
  return { name, isDirectory, children: new Map<string, TreeNode>() };
}
