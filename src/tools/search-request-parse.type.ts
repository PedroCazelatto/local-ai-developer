// parseSearchRequest's answer, as a union the caller must narrow. A bad argument is always a
// recoverable message the model can act on, never a throw.

import type { SearchRequest } from './search-request.type.js';

/** parseSearchRequest's answer: a request to run, or the model-facing reason it is not one. */
export type SearchRequestParse =
  | { readonly ok: true; readonly request: SearchRequest }
  | { readonly ok: false; readonly error: string; readonly hint?: string };
