// The compact +/- diff shown in the scrollback after write_file / edit_file / edit_phase_rule.
//
// Only the write tools can produce this: they already hold the file's bytes BEFORE and AFTER (edit_file
// reads before it splices, write_file reads to tell a create from an overwrite), so the diff costs no
// extra container round-trip. The dispatch choke point sees neither, which is why the answer travels
// out on the result rather than being derived downstream.
//
// The caps live here, with the algorithm, because it is the algorithm that decides whether the body is
// worth materializing at all. Over the caps the lines are simply not built — a collapsed diff shows
// counts only, so there was never a reason to hold a thousand rows to throw them away.
//
// Counts are EXACT or absent, never approximated (constitution: a metric that isn't available is
// surfaced, not guessed). The exact path is a common-prefix/suffix trim followed by an LCS over
// whatever is left, which for the single-splice shape edit_file always produces reduces to a handful
// of lines. A scattered rewrite of a very large file is the one case the LCS is too big to run, and
// there this returns null — the caller then reports the file's before/after line totals, which are
// facts, instead of inventing a count.

import type { ToolDiffDisplay } from '../core/ui/tool-call-display.type.js';

/** Above this many changed lines (added + removed) the diff collapses to counts. */
export const DIFF_MAX_CHANGED_LINES = 20;

/**
 * Above this many characters of diff body the diff collapses to counts, even under the line cap. One
 * generated or minified 4,000-character line counts as a single changed line and would still wrap to
 * fifty rows; this is the guard for exactly that. Deliberately NOT a row count: rows depend on the
 * terminal width, and append-only history must not have been decided by the width it happened to have.
 */
export const DIFF_MAX_CHARS = 2000;

/**
 * Work ceiling for the exact LCS, in cells. Applied to the CHANGED REGION after the prefix/suffix
 * trim, so a five-line edit to a three-thousand-line file is a 5x5 problem, not a 3000x3000 one. Only
 * a near-total rewrite of a 1,000-line-plus file reaches it.
 */
const LCS_MAX_CELLS = 1_000_000;

/** Split file text into lines; '' is zero lines rather than one empty one. */
function toLines(text: string): string[] {
  return text === '' ? [] : text.split('\n');
}

/** How many leading lines the two sides share. */
function commonPrefix(before: readonly string[], after: readonly string[]): number {
  const limit = Math.min(before.length, after.length);
  let count = 0;
  while (count < limit && before[count] === after[count]) count += 1;
  return count;
}

/** How many trailing lines the two sides share, without overrunning the prefix already claimed. */
function commonSuffix(before: readonly string[], after: readonly string[], prefix: number): number {
  const limit = Math.min(before.length, after.length) - prefix;
  let count = 0;
  while (count < limit && before[before.length - 1 - count] === after[after.length - 1 - count]) count += 1;
  return count;
}

/**
 * The exact edit script between two changed regions, as '+'/'-' prefixed rows, via a bottom-up LCS
 * table walked forward. Returns null when the table would exceed LCS_MAX_CELLS.
 */
function editScript(before: readonly string[], after: readonly string[]): string[] | null {
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

/**
 * The diff between two versions of one file, ready to print — or null when the change is too large to
 * count exactly (the caller reports line totals instead).
 *
 * `lines` comes back EMPTY when the change is over either cap: the counts are still exact, and the
 * result line collapses to `+12 −3 <path>`.
 */
export function buildFileDiff(path: string, before: string, after: string): ToolDiffDisplay | null {
  const beforeLines = toLines(before);
  const afterLines = toLines(after);

  const prefix = commonPrefix(beforeLines, afterLines);
  const suffix = commonSuffix(beforeLines, afterLines, prefix);
  const changedBefore = beforeLines.slice(prefix, beforeLines.length - suffix);
  const changedAfter = afterLines.slice(prefix, afterLines.length - suffix);

  // A pure insertion or a pure deletion needs no LCS — one side of the changed region is empty, so
  // every line of the other side is exactly one edit. This is the whole of a write_file create.
  let script: string[] | null;
  if (changedBefore.length === 0) {
    script = changedAfter.map((line) => `+${line}`);
  } else if (changedAfter.length === 0) {
    script = changedBefore.map((line) => `-${line}`);
  } else {
    script = editScript(changedBefore, changedAfter);
  }
  if (script === null) return null;

  let added = 0;
  let removed = 0;
  for (const row of script) {
    if (row.startsWith('+')) added += 1;
    else removed += 1;
  }

  const overLineCap = added + removed > DIFF_MAX_CHANGED_LINES;
  const overCharCap = !overLineCap && script.join('\n').length > DIFF_MAX_CHARS;
  return { path, added, removed, lines: overLineCap || overCharCap ? [] : script };
}
