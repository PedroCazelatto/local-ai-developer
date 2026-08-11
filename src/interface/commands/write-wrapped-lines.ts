// Print a run of FREE TEXT — a blocker's question, an inbox item's body — as however many rows it
// takes, each one inside the terminal's width.
//
// The difference from write-fitted-line.ts is which of the two guarantees matters. A table row is cut
// at the edge because its shape is the information and its tail is not: /audit's rows and the task
// tree's titles lose nothing important to an ellipsis. Free text is the opposite — it IS the
// information, and a blocker question cut at column 79 is a question the user cannot answer. So this
// wraps at spaces instead of cutting, and every row it produces still goes out through the fitted
// writer, which keeps the one-row-per-line guarantee in exactly one place.

import { singleLine } from '../../core/ui/single-line.js';
import { terminalColumns } from '../../core/ui/terminal-columns.js';
import { wordWrap } from '../../core/ui/word-wrap.js';
import { writeFittedLine } from './write-fitted-line.js';
import type { RowStyle } from './write-fitted-line.type.js';

/**
 * Write `text` under `indent`, wrapped at spaces to the terminal's width and painted with `style`.
 * The indent is re-applied to every wrapped row (wordWrap's hanging indent), so a continuation stays
 * visually inside the block it belongs to rather than escaping to the left margin.
 */
export function writeWrappedLines(text: string, indent: string, style: RowStyle): void {
  // singleLine FIRST: the model wrote this text and it may hold real newlines, which wordWrap would
  // carry inside a "word" and mis-measure. Flattened here, the wrap is the only thing making rows.
  // wordWrap: break only at spaces, measuring DISPLAY columns (wide glyphs count two), splitting a
  // word only when it could never fit — so every row it returns already fits the terminal.
  for (const row of wordWrap(`${indent}${singleLine(text)}`, terminalColumns())) writeFittedLine(row, style);
}
