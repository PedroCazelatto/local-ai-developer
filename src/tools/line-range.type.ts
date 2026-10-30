// An inclusive 1-based span of lines to print. Spoken by the range merger and the renderer that
// consumes its output; a private copy in either would be able to disagree about what a range means.

/** An inclusive 1-based span of lines to print. */
export interface LineRange {
  readonly start: number;
  readonly end: number;
}
