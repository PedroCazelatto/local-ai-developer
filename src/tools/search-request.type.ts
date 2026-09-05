// One validated search_in_files call. Folder vocabulary: parseSearchRequest produces it and the tool
// then hands its fields to five helpers, none of which owns the request itself.

import type { SearchOutputMode } from './search-output-mode.type.js';

/** A validated call — what to look for, where, and how much of it to send back. */
export interface SearchRequest {
  /** Literal substring. Never a regular expression: see the tool's header comment for why. */
  readonly pattern: string;
  /** Filename glob, or null for every file. */
  readonly glob: string | null;
  readonly outputMode: SearchOutputMode;
  /** Lines either side of a match. 0 keeps the flat `path:line: text` format. */
  readonly contextLines: number;
  /** false — the default — folds case on both sides before comparing. */
  readonly caseSensitive: boolean;
}
