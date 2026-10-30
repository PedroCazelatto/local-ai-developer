// renderFileTree — the indented listing list_files sends back. Pure: it touches no filesystem and
// runs no container command, it only arranges paths that were handed to it.
//
// Indented rather than one full path per row, because a full path repeats its parents on every row
// and the parents are the part the model already knows. `src/` once and `  index.ts` under it costs a
// fraction of `src/index.ts` per file, and the shape of the tree is legible at a glance.
//
// Ordering at every level: FILES first, then directories, each alphabetical by code unit (so `README`
// precedes `package.json`, as an ASCII sort does). Files first because they are the answer to "what
// is here", while a directory is an invitation to ask again.
//
// The cap is applied in this same depth-first order, which is what keeps a truncated listing
// coherent: a row is only ever emitted after its parent, so nothing is left orphaned under a
// directory that was cut.

import { emptyTreeNode } from './empty-tree-node.js';
import { orderTreeChildren } from './order-tree-children.js'; // files first, then directories, by code unit
import type { TreeNode } from './tree-node.type.js';
import type { WorkspaceEntry } from './workspace-entry.type.js';

/**
 * `entries` as an indented tree, capped at `maxEntries` rows.
 *
 * Every path must be project-root-relative; `basePath` is the directory that was listed and is
 * stripped from each row, so listing `src/core` prints its contents at the left margin rather than
 * re-stating `src/core/` on every line. Returns the rows and how many entries did not fit.
 */
export function renderFileTree(
  entries: readonly WorkspaceEntry[],
  basePath: string,
  maxEntries: number,
): { readonly rows: string[]; readonly omitted: number } {
  const prefix = basePath === '' || basePath === '.' ? '' : `${basePath.replace(/\/+$/, '')}/`;
  const root = emptyTreeNode('', true);

  for (const entry of entries) {
    const relative = entry.path.startsWith(prefix) ? entry.path.slice(prefix.length) : entry.path;
    if (relative === '') continue;
    const segments = relative.split('/');
    let node = root;
    segments.forEach((segment, index) => {
      const last = index === segments.length - 1;
      let child = node.children.get(segment);
      if (child === undefined) {
        // An intermediate segment is a directory by construction; only the leaf carries the real kind.
        child = emptyTreeNode(segment, last ? entry.isDirectory : true);
        node.children.set(segment, child);
      }
      node = child;
    });
  }

  const rows: string[] = [];
  let total = 0;
  const walk = (node: TreeNode, depth: number): void => {
    for (const child of orderTreeChildren(node.children.values())) {
      total += 1;
      if (rows.length < maxEntries) {
        rows.push(`${'  '.repeat(depth)}${child.name}${child.isDirectory ? '/' : ''}`);
      }
      walk(child, depth + 1);
    }
  };
  walk(root, 0);

  return { rows, omitted: total - rows.length };
}
