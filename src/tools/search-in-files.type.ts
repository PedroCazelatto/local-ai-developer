// The vocabulary of one search_in_files call, shared by the tool and its five helpers: the validated
// request, the per-file match record the helpers hand each other, the line spans the renderer prints,
// and the outcome the closing notice is written from.
//
// ONE type file for the whole tool rather than one per helper: these types are a single conversation
// about a single search, and a helper that took its own private copy of `LineRange` would be able to
// disagree with the renderer about what a range means.

/** Which shape the result takes: matching lines (the default) or the file list alone. */
export type SearchOutputMode = 'content' | 'paths';

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

/** parseSearchRequest's answer: a request to run, or the model-facing reason it is not one. */
export type SearchRequestParse =
  | { readonly ok: true; readonly request: SearchRequest }
  | { readonly ok: false; readonly error: string; readonly hint?: string };

/** The matching lines of ONE file, already cut to the per-file ceiling. */
export interface MatchedLines {
  /** 1-based line numbers holding the pattern, ascending, no more than the limit allowed. */
  readonly lines: readonly number[];
  /** Matches this file holds BEYOND the ones above — 0 when nothing was dropped. */
  readonly omitted: number;
}

/** An inclusive 1-based span of lines to print. */
export interface LineRange {
  readonly start: number;
  readonly end: number;
}

/**
 * The three ceilings a search runs under. Passed in rather than imported, so the numbers live at one
 * call site (search-in-files.ts) and no helper can hold a second opinion about them.
 */
export interface SearchCaps {
  /** Total output lines the result may hold, before the closing notice. */
  readonly maxOutputLines: number;
  /** Total matches across all files — matching FILES when output_mode is "paths". */
  readonly maxMatches: number;
  /** Matches any one file may contribute, so a hot file cannot starve the rest. */
  readonly maxMatchesPerFile: number;
}

/** Which ceiling ended the search early, or null when the whole project was searched. */
export type SearchStopReason = 'lines' | 'matches' | null;

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
