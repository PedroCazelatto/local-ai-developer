// Resolve `target` through any symlinks, WITHOUT requiring it to exist. Walks up to the deepest
// ancestor that does exist, calls realpathSync there, and re-joins the segments that do not exist
// yet onto the real answer.
//
// The "does not exist yet" half is the whole reason this is not a bare realpathSync: write_file's
// first call for a file names a path that is about to be created, and it still has to be scoped
// before anything is created. Only the existing part of a path can lie about where it points, so
// resolving that part is sufficient.

import { realpathSync } from 'node:fs';
import path from 'node:path';

export function realPathOfNearestExisting(target: string): string {
  let current = path.resolve(target);
  const missing: string[] = [];
  for (;;) {
    try {
      return path.join(realpathSync(current), ...missing);
    } catch {
      const parent = path.dirname(current);
      // dirname of a filesystem root is itself — nothing on this path exists, so there is no link to
      // resolve and the lexical answer is already the real one.
      if (parent === current) return path.resolve(target);
      missing.unshift(path.basename(current));
      current = parent;
    }
  }
}
