// The order one level of list_files' tree is printed in: FILES first, then directories, each
// alphabetical by code unit.
//
// Files first because they are the answer to "what is here", while a directory is an invitation to
// ask again. By code unit rather than by locale so `README` precedes `package.json`, as an ASCII sort
// does — a listing the model reads twice must come back the same way both times.
//
// It is `orderTreeChildren` rather than `ordered`, which as a file name says nothing about what is
// ordered or by what.

import type { TreeNode } from './tree-node.type.js';

/** Files before directories; within each group, ascending by code unit. */
export function orderTreeChildren(children: Iterable<TreeNode>): TreeNode[] {
  const nodes = [...children];
  nodes.sort((left, right) => {
    if (left.isDirectory !== right.isDirectory) return left.isDirectory ? 1 : -1;
    return left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
  });
  return nodes;
}
