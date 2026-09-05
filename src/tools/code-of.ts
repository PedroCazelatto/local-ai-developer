// A thrown Node OS error's `code` (ENOENT, EISDIR, EACCES, …), read without asserting `any`.
//
// NOTE: this has NO caller. It was written for the file tools' host-side era and became unreachable
// when they moved into the container -- the sandbox reports a missing path as `{ ok: false, notFound:
// true }` rather than by throwing an ENOENT. It is carried here unchanged rather than deleted,
// because deleting live-looking code is a decision to take on purpose and not in passing during a
// mechanical split; the one-function-per-file sweep has reported it for a deliberate removal.

/** Node OS errors carry a string `code` (ENOENT, EISDIR, EACCES, …); read it without asserting `any`. */
export function codeOf(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}
