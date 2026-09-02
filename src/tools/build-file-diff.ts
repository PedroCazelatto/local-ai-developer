// The compact +/- diff shown in the scrollback after write_file / edit_file / edit_phase_rule.
//
// Only the write tools can produce this: they already hold the file's bytes BEFORE and AFTER (edit_file
// reads before it splices, write_file reads to tell a create from an overwrite), so the diff costs no
// extra container round-trip. The dispatch choke point sees neither, which is why the answer travels
// out on the result rather than being derived downstream.
//
// The caps live here, with the assembly, because it is the assembly that decides whether the body is
// worth materializing at all. Over the caps the lines are simply not built — a collapsed diff shows
// counts only, so there was never a reason to hold a thousand rows to throw them away.
//
// Counts are EXACT or absent, never approximated (constitution: a metric that isn't available is
// surfaced, not guessed). The exact path is a common-prefix/suffix trim followed by an LCS over
// whatever is left (build-edit-script.ts), which for the single-splice shape edit_file always produces
// reduces to a handful of lines. A scattered rewrite of a very large file is the one case the LCS is
// too big to run, and there this returns null — the caller then reports the file's before/after line
// totals, which are facts, instead of inventing a count.

import type { ToolDiffDisplay } from '../core/ui/types.js';
import { buildEditScript } from './build-edit-script.js'; // the exact LCS, or null over its work ceiling
import { commonPrefixLines } from './common-prefix-lines.js';
import { commonSuffixLines } from './common-suffix-lines.js';
import { splitFileLines } from './split-file-lines.js'; // '' is zero lines, not one empty one

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
 * The diff between two versions of one file, ready to print — or null when the change is too large to
 * count exactly (the caller reports line totals instead).
 *
 * `lines` comes back EMPTY when the change is over either cap: the counts are still exact, and the
 * result line collapses to `+12 −3 <path>`.
 */
export function buildFileDiff(path: string, before: string, after: string): ToolDiffDisplay | null {
  const beforeLines = splitFileLines(before);
  const afterLines = splitFileLines(after);

  const prefix = commonPrefixLines(beforeLines, afterLines);
  const suffix = commonSuffixLines(beforeLines, afterLines, prefix);
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
    script = buildEditScript(changedBefore, changedAfter);
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
