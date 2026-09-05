// The three ceilings a search runs under. Passed in rather than imported, so the numbers live at one
// call site (search-in-files.ts) and no helper can hold a second opinion about them.

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
