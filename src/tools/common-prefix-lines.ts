// How much of two file versions is identical at the TOP. Half of the trim that keeps the exact diff
// affordable: an edit_file splice touches one contiguous region, so trimming the shared prefix and
// suffix reduces a 3,000-line file to the handful of lines that actually changed before the LCS runs.

/** How many leading lines the two sides share. */
export function commonPrefixLines(before: readonly string[], after: readonly string[]): number {
  const limit = Math.min(before.length, after.length);
  let count = 0;
  while (count < limit && before[count] === after[count]) count += 1;
  return count;
}
