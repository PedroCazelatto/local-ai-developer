// An inbox_resolve outcome: the resolved id, or a structured rejection. Never a thrown error, because
// the model is expected to read the reason and act on it.

import type { InboxResolveError } from './inbox-resolve-error.type.js';

/** `inbox_resolve` outcome: the resolved id, or a structured rejection (never a thrown error). */
export type InboxResolveResult =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly error: InboxResolveError; readonly message: string };
