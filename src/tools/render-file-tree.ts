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

import type { WorkspaceEntry } from './list-files.type.js';

interface TreeNode {
  readonly name: string;
  readonly isDirectory: boolean;
  readonly children: Map<string, TreeNode>;
}

function emptyNode(name: string, isDirectory: boolean): TreeNode {
  return { name, isDirectory, children: new Map<string, TreeNode>() };
}

/** Files before directories; within each group, ascending by code unit. */
function ordered(children: Iterable<TreeNode>): TreeNode[] {
  const nodes = [...children];
  nodes.sort((left, right) => {
    if (left.isDirectory !== right.isDirectory) return left.isDirectory ? 1 : -1;
    return left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
  });
  return nodes;
}

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
  const root = emptyNode('', true);

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
        child = emptyNode(segment, last ? entry.isDirectory : true);
        node.children.set(segment, child);
      }
      node = child;
    });
  }

  const rows: string[] = [];
  let total = 0;
  const walk = (node: TreeNode, depth: number): void => {
    for (const child of ordered(node.children.values())) {
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
