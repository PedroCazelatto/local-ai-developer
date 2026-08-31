// How a path longer than the ustar `name` field is carried: split it across `prefix` + `name`, which
// the extractor rejoins with a `/`. The rare name that will not split that way has no ustar spelling
// at all, and encode-tar.ts falls back to a GNU long-name entry for it.

import { NAME_MAX, PREFIX_MAX } from './tar-format.js';

/**
 * Split `path` into the ustar `prefix`/`name` pair, or null when no `/` boundary yields two pieces
 * that fit. Longest possible prefix wins, so `name` stays as short as it can.
 */
export function splitUstarName(path: string): { readonly prefix: string; readonly name: string } | null {
  if (Buffer.byteLength(path) <= NAME_MAX) return { prefix: '', name: path };
  for (let cut = path.lastIndexOf('/'); cut > 0; cut = path.lastIndexOf('/', cut - 1)) {
    const prefix = path.slice(0, cut);
    const name = path.slice(cut + 1);
    if (Buffer.byteLength(prefix) <= PREFIX_MAX && Buffer.byteLength(name) <= NAME_MAX) {
      return { prefix, name };
    }
  }
  return null;
}
