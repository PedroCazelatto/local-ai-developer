// What the scrollback says about a write_file call.
//
// It is `buildWriteDisplay` rather than `writeDisplay`: the old name reads as an instruction to write
// something, and what it does is BUILD the display record -- the same spelling buildFileDiff beside it
// uses for the same kind of job.

import type { ToolCallDisplay } from '../core/ui/types.js';
// The compact +/- diff; null when the change is too large to count exactly.
import { buildFileDiff } from './build-file-diff.js';
import { decodeUtf8Strict } from './decode-utf8-strict.js';
import { lineCount } from './line-count.js';

/**
 * What the scrollback says about a write: `created +42` for a new file, `overwrote +12 −3` for one
 * that already existed, each with the diff under it (collapsed to counts when it is large).
 *
 * A file whose previous bytes are not UTF-8 text, or a rewrite too large to diff exactly, has no
 * counts to give — those report the file's before/after line totals instead, which are facts. Nothing
 * here ever guesses a count.
 */
export function buildWriteDisplay(path: string, previous: Uint8Array | null, content: string): ToolCallDisplay {
  let before: string | null = '';
  if (previous !== null) {
    try {
      before = decodeUtf8Strict(previous);
    } catch {
      before = null; // binary or invalid UTF-8: there is no line-wise diff to show
    }
  }
  const verb = previous === null ? 'created' : 'overwrote';
  if (before === null) {
    return { summary: `${verb} ${content.length} characters (previous content is not UTF-8 text)` };
  }
  const diff = buildFileDiff(path, before, content);
  if (diff === null) {
    return { summary: `${verb} ${lineCount(before)} lines → ${lineCount(content)} lines` };
  }
  if (diff.added === 0 && diff.removed === 0) {
    return { summary: `${verb} — no change`, diff };
  }
  const counts = diff.removed === 0 ? `+${diff.added}` : `+${diff.added} −${diff.removed}`;
  return { summary: `${verb} ${counts}`, diff };
}
