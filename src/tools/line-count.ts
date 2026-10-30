// How many lines a piece of text holds, for the write tools' "42 lines → 57 lines" summary.
//
// The invariant is the empty-string case, and it is the same one split-file-lines.ts carries for an
// array: `''.split('\n').length` is 1 and an empty file has no lines. The two stay separate rather
// than one calling the other, because a caller that wants the count should not have to materialise
// the array to get it.

/** How many lines a piece of text holds; '' is zero lines rather than one empty one. */
export function lineCount(text: string): number {
  return text === '' ? 0 : text.split('\n').length;
}
