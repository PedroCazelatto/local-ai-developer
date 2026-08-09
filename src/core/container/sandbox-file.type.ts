// Results of the sandbox's file transport. RECOVERABLE like ExecResult: a missing file, a stopped
// container or a daemon error comes back as a value, never a throw — the file tools turn each into
// the structured error the model reads and retries from, and a thrown error would kill the turn.

export type SandboxRead =
  | { readonly ok: true; readonly kind: 'file'; readonly bytes: Uint8Array }
  | { readonly ok: true; readonly kind: 'directory' }
  /** `notFound` separates "no such path" (the model's typo) from a daemon/container failure. */
  | { readonly ok: false; readonly notFound: boolean; readonly message: string };

export type SandboxWrite = { readonly ok: true } | { readonly ok: false; readonly message: string };
