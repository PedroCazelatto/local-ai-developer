// How much of two file versions is identical at the BOTTOM — the other half of the trim
// common-prefix-lines.ts describes.
//
// It takes the prefix already claimed and refuses to overrun it. Without that, two versions of a file
// made entirely of identical lines would have the same rows counted twice, and the changed region
// would come out with a negative length.

/** How many trailing lines the two sides share, without overrunning the prefix already claimed. */
export function commonSuffixLines(before: readonly string[], after: readonly string[], prefix: number): number {
  const limit = Math.min(before.length, after.length) - prefix;
  let count = 0;
  while (count < limit && before[before.length - 1 - count] === after[after.length - 1 - count]) count += 1;
  return count;
}
