// The exact '+'/'-' edit script between two changed regions, by a bottom-up LCS table walked forward.
//
// It is named `build...` rather than `editScript` because a bare noun reads like the data it returns
// -- and buildFileDiff, which is the only caller, spells the same job the same way.
//
// The work ceiling is the reason this can be exact at all: it is applied to the CHANGED REGION after
// buildFileDiff's prefix/suffix trim, so a five-line edit to a three-thousand-line file is a 5x5
// problem rather than a 3000x3000 one. Only a near-total rewrite of a 1,000-line-plus file reaches it,
// and there the answer is null -- the caller then reports the file's before/after line totals, which
// are facts, instead of inventing a count (constitution: a metric that is not available is surfaced,
// never guessed).

/**
 * Work ceiling for the exact LCS, in cells. Applied to the CHANGED REGION after the prefix/suffix
 * trim, so a five-line edit to a three-thousand-line file is a 5x5 problem, not a 3000x3000 one. Only
 * a near-total rewrite of a 1,000-line-plus file reaches it.
 */
const LCS_MAX_CELLS = 1_000_000;

/**
 * The exact edit script between two changed regions, as '+'/'-' prefixed rows, via a bottom-up LCS
 * table walked forward. Returns null when the table would exceed LCS_MAX_CELLS.
 */
export function buildEditScript(before: readonly string[], after: readonly string[]): string[] | null {
  const rows = before.length;
  const cols = after.length;
  if ((rows + 1) * (cols + 1) > LCS_MAX_CELLS) return null;

  const width = cols + 1;
  const lengths = new Int32Array((rows + 1) * width);
  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      lengths[i * width + j] =
        before[i] === after[j]
          ? (lengths[(i + 1) * width + j + 1] ?? 0) + 1
          : Math.max(lengths[(i + 1) * width + j] ?? 0, lengths[i * width + j + 1] ?? 0);
    }
  }

  const script: string[] = [];
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (before[i] === after[j]) {
      i += 1; // an unchanged line: a compact diff shows only what changed, so nothing is emitted
      j += 1;
    } else if ((lengths[(i + 1) * width + j] ?? 0) >= (lengths[i * width + j + 1] ?? 0)) {
      script.push(`-${before[i] ?? ''}`);
      i += 1;
    } else {
      script.push(`+${after[j] ?? ''}`);
      j += 1;
    }
  }
  while (i < rows) {
    script.push(`-${before[i] ?? ''}`);
    i += 1;
  }
  while (j < cols) {
    script.push(`+${after[j] ?? ''}`);
    j += 1;
  }
  return script;
}
