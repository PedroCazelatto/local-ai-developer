// Split file text into the lines a diff counts.
//
// The whole content of this function is the empty-string case: `''.split('\n')` is `['']`, one empty
// line, and an empty file has none. Getting that wrong makes a create of a 1-line file report `+2`.
// line-count.ts holds the same invariant for a count rather than an array; they are deliberately two
// functions, because collapsing them would put a `.length` at every call site that wants the array.

/** Split file text into lines; '' is zero lines rather than one empty one. */
export function splitFileLines(text: string): string[] {
  return text === '' ? [] : text.split('\n');
}
