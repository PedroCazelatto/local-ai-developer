// The containment test behind the container-side scope check (resolve-real-workspace-path.ts): once
// every symlink on a path has been followed, is the answer still inside the project?
//
// It reads WORKSPACE_PATH rather than a literal of its own. The private copy this was extracted from
// declared the string a second time, and a containment check that disagreed with the mount point by
// one character would pass a path that leaves the project.

import { WORKSPACE_PATH } from './workspace-path.js';

/** True when `resolved` is /workspace itself or something strictly beneath it. */
export function insideWorkspace(resolved: string): boolean {
  return resolved === WORKSPACE_PATH || resolved.startsWith(`${WORKSPACE_PATH}/`);
}
