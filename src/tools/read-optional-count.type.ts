// Result of readOptionalCount: either the integer (null when the caller omitted it), or the
// model-facing reason the value was rejected. Mirrors git_inspect's readPaths union — a bad argument
// is always a recoverable message the model can act on, never a throw.

export type OptionalCount =
  | { readonly ok: true; readonly value: number | null }
  | { readonly ok: false; readonly error: string };
