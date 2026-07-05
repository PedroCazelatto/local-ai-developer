// Shared host-side FS helpers for the file tools (V1/03). Small, boring, and identical across
// read/write/edit/search so the error wording stays consistent with the Python ports.

/** Human-readable message from any thrown value. */
export function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Node OS errors carry a string `code` (ENOENT, EISDIR, EACCES, …); read it without asserting `any`. */
export function codeOf(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

/**
 * Decode bytes as strict UTF-8. Throws a TypeError on an invalid sequence — the file tools map that
 * to their "is not valid UTF-8 text" error (matching the Python UnicodeDecodeError branch).
 */
export function decodeUtf8Strict(buffer: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
}

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
