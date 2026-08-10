// Result of the look-before-you-write guard (guard-write-target.ts). A refusal carries BOTH halves the
// model needs: what is wrong, and which of the two fixes applies — the whole point of the guard is
// that "read it first" and "read it again" are different instructions.

export type GuardWriteResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string; readonly hint: string };
