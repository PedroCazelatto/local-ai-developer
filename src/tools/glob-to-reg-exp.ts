// The `glob` argument of search_in_files, as a RegExp. A deliberately small subset -- `*` and `?`
// only -- with every other character escaped to itself, so a model that sends `report(1).txt` matches
// that filename rather than a regular expression it did not mean to write.

/** Translate a shell-style filename glob (subset: `*`, `?`) to an anchored RegExp; everything else literal. */
export function globToRegExp(glob: string): RegExp {
  let out = '';
  for (const c of glob) {
    if (c === '*') out += '.*';
    else if (c === '?') out += '.';
    else out += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${out}$`);
}
