// What a search actually covered -- the input to the notice that closes every result. Assembled by
// the tool and consumed by summarizeSearch, so it belongs to the folder rather than to either.

import type { SearchCaps } from './search-caps.type.js';
import type { SearchOutputMode } from './search-output-mode.type.js';
import type { SearchStopReason } from './search-stop-reason.type.js';

/** What the search actually covered — the input to the notice that closes every result. */
export interface SearchOutcome {
  readonly stop: SearchStopReason;
  readonly matches: number;
  readonly files: number;
  readonly outputMode: SearchOutputMode;
  readonly contextLines: number;
  readonly caps: SearchCaps;
  /** true when a `glob` already narrowed this search — the notice must not suggest one twice. */
  readonly narrowed: boolean;
}
