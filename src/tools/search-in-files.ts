// search_in_files (V1/03) — LITERAL substring search over the UTF-8 text files under the project root,
// case-INSENSITIVE by default. Optional filename glob. Forward-slash paths regardless of host OS.
//
// TWO STEPS, both inside the sandbox. `grep -l` in the container decides WHICH files hold the pattern
// (one round trip, vendored trees pruned before grep opens them), then only those files are pulled
// across as bytes and scanned here. Nothing walks the host: a symlink planted in the project would
// otherwise let a search read host files into the model's window — a link is an exfiltration path IN,
// not just a write path out. `output_mode:"paths"` never leaves step one, so it transfers no content
// at all, which is most of why it is the cheap mode.
//
// Where the two steps disagree: grep selects candidates, and for "content" the authority is still
// findMatchingLines here — a candidate whose matches it cannot confirm simply contributes nothing. In
// "paths" mode grep IS the authority, since confirming would mean reading every file and paying the
// exact cost the mode exists to avoid. With -F fixed strings under LC_ALL=C.UTF-8 the two agree on
// anything short of exotic Unicode case folding.
//
// Not a regular expression, on purpose. Regex is the most-requested shape and the one with a real
// denial-of-service edge: a catastrophically backtracking pattern from a confidently-wrong model wedges
// the turn, and the turn cancel does not reach it — a Ctrl+C arms a cancel that the NEXT model call
// consumes, and a search spinning inside this synchronous loop never reaches one (it holds the event
// loop, so the keypress is not even read). Fixed strings plus case folding cover most of the value with
// none of that.
//
// A search answers two questions with very different prices — "where does this live?" needs paths;
// "what does it say there?" needs lines — so the tool answers each at its own price:
//   - `output_mode:"paths"` — the file list alone, one line per file.
//   - `context_lines:N` — N lines either side of each match, merged where they overlap. A few lines
//     of context is usually enough to decide, and costs a fraction of the read_file it replaces.
//
// EVERYTHING IS BOUNDED, and the bound the model cannot raise is the point: three ceilings, whichever
// fires first, and a closing notice that names which one it was (summarize-search.ts). A match count
// alone stopped being a bound the moment matches could carry context — 200 matches x 7 lines is not a
// bounded result — so the line budget is what actually holds the window, with the match caps beneath it.

import path from 'node:path';

import { decodeUtf8Strict } from './decode-utf8-strict.js';
import { findMatchingLines } from './find-matching-lines.js';
import { globToRegExp } from './glob-to-reg-exp.js';
// One `grep -l` in the container: the project-root-relative paths that hold the pattern, sorted.
import { listSearchCandidates } from './list-search-candidates.js';
import { parseSearchRequest } from './parse-search-request.js';
import { renderFileMatches } from './render-file-matches.js';
import type { SearchCaps, SearchStopReason } from './search-in-files.type.js';
import { summarizeSearch } from './summarize-search.js';
import { toolError } from './tool-error.js';
import type { ToolModule } from './tool-module.type.js';
import type { ToolResult } from './tool-result.type.js';

/**
 * The three ceilings, in one place. 200 output lines is roughly an eighth of a 16k window once the
 * system prompt is paid for — a search may inform a turn, it may not become the turn. The 200-match
 * cap is what this tool always had; 20 per file stops one hot file consuming the whole result and
 * starving the other files that also matched.
 */
export const SEARCH_CAPS: SearchCaps = {
  maxOutputLines: 200,
  maxMatches: 200,
  maxMatchesPerFile: 20,
};

export const searchInFilesTool: ToolModule = {
  name: 'search_in_files',
  description:
    "Find a literal substring in the project's text files. Case-insensitive by default, and NOT a " +
    'regular expression. Returns one line per match as `path:line: text`. Two arguments make this much ' +
    'cheaper than reading files: `output_mode:"paths"` returns only WHICH files match — reach for it ' +
    'first when you are locating something — and `context_lines` returns that many lines either side of ' +
    'each match, which is often enough to answer your question without a read_file. Narrow to one kind ' +
    "of file with a glob, e.g. '*.ts'. " +
    `The result is capped at ${SEARCH_CAPS.maxOutputLines} lines, ${SEARCH_CAPS.maxMatches} matches, ` +
    `and ${SEARCH_CAPS.maxMatchesPerFile} matches per file; you cannot raise the caps, so narrow a broad ` +
    'search instead. The last line of every result tells you whether you saw all of it.',
  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Literal substring to search for. No wildcards, no anchors, no regex syntax.',
      },
      glob: {
        type: 'string',
        description: "Optional filename glob to filter files (e.g. '*.ts'). Defaults to all files.",
      },
      output_mode: {
        type: 'string',
        description:
          'One of "content" (default — matching lines) or "paths" (only the paths of matching files, ' +
          'no lines). Use "paths" when you need to know where something lives, then search again or ' +
          'read the file for what it says.',
        default: 'content',
      },
      context_lines: {
        type: 'number',
        description:
          'Lines of context to include either side of each match. Defaults to 0 — the matching line ' +
          'only. Try 3 when you want to understand a match rather than just locate it. Ignored when ' +
          'output_mode is "paths".',
        default: 0,
      },
      case_sensitive: {
        type: 'boolean',
        description: 'Set true to match case exactly. Defaults to false, so "Tool" also finds "tool".',
        default: false,
      },
    },
    required: ['pattern'],
  },

  async execute(ctx, args): Promise<ToolResult> {
    // parseSearchRequest validates every argument and normalizes the defaults (content mode, no
    // context, case-insensitive), or returns the model-facing reason the call was not valid.
    const parsed = parseSearchRequest(args);
    if (!parsed.ok) return toolError(parsed.error, parsed.hint);
    const request = parsed.request;

    // listSearchCandidates: `grep -rlIF` in the sandbox, with SKIP_DIRS pruned and the glob passed as
    // --include. It narrows the project to the files worth transferring; it does not decide the answer.
    const candidates = await listSearchCandidates(
      ctx.sandbox,
      request.pattern,
      request.glob,
      request.caseSensitive,
    );
    if (!candidates.ok) {
      return toolError(`Error searching for '${request.pattern}': ${candidates.message}`);
    }

    // grep's --include already applied this glob; re-applying globToRegExp keeps the committed
    // `*`/`?`-on-the-basename semantics authoritative rather than deferring to the container's fnmatch.
    const globRe = request.glob !== null ? globToRegExp(request.glob) : null;
    // Fold the needle ONCE for the whole search; the per-file scan folds each line it tests.
    const needle = request.caseSensitive ? request.pattern : request.pattern.toLowerCase();

    const rows: string[] = [];
    let matches = 0;
    let files = 0;
    let stop: SearchStopReason = null;

    for (const relative of candidates.paths) {
      if (globRe !== null && !globRe.test(path.posix.basename(relative))) continue;

      if (request.outputMode === 'paths') {
        // The file list IS the answer here, and grep already established it — so this mode never
        // transfers a byte of content. That is the whole reason it is the cheap one.
        rows.push(relative);
        files += 1;
        matches += 1; // in this mode a "match" IS a file, so maxMatches is the file cap
        if (matches >= SEARCH_CAPS.maxMatches) {
          stop = 'matches';
          break;
        }
        if (rows.length >= SEARCH_CAPS.maxOutputLines) {
          stop = 'lines';
          break;
        }
        continue;
      }

      // Content mode pays for the bytes, one candidate at a time, and stops as soon as a ceiling
      // fires — so the number of transfers is bounded by the caps, not by the size of the project.
      const read = await ctx.sandbox.readWorkspaceFile(relative);
      if (!read.ok || read.kind !== 'file') continue; // vanished or a directory — skipped silently
      let text: string;
      try {
        text = decodeUtf8Strict(read.bytes);
      } catch {
        continue; // not UTF-8 text — skipped silently, as the host-side walk did
      }

      const lines = text.split('\n');
      // findMatchingLines returns this file's matching line numbers plus how many it had to leave
      // behind. The limit is the per-file cap OR whatever the global budget still has room for,
      // whichever is smaller — so the last file scanned cannot push the total past the match cap.
      const headroom = SEARCH_CAPS.maxMatches - matches;
      const matched = findMatchingLines(
        lines,
        needle,
        !request.caseSensitive,
        Math.min(SEARCH_CAPS.maxMatchesPerFile, headroom),
      );
      if (matched.lines.length === 0) continue;

      // renderFileMatches turns those line numbers into this file's output rows: flat
      // `path:line: text` at context 0, otherwise the path once with a numbered block under it,
      // overlapping context merged, `→` on matches and `|` on context.
      let emitted = 0;
      for (const row of renderFileMatches(relative, lines, matched, request.contextLines)) {
        if (rows.length >= SEARCH_CAPS.maxOutputLines) {
          stop = 'lines';
          break;
        }
        // A blank line between per-file blocks — only the grouped format has blocks to separate, and
        // only ever written immediately before the row it introduces. Written eagerly it could take
        // the budget's last slot and leave the result ending on a blank row that separates nothing.
        if (emitted === 0 && request.contextLines > 0 && rows.length > 0) {
          if (rows.length + 1 >= SEARCH_CAPS.maxOutputLines) {
            stop = 'lines'; // no room for the separator AND a row: this file contributes nothing
            break;
          }
          rows.push('');
        }
        rows.push(row);
        emitted += 1;
      }
      // Counted only when the file actually reached the output. A file whose rows were all refused by
      // the budget must not appear in the closing notice's totals — the notice is what the model
      // judges its coverage from, so it may not credit a file it never saw.
      if (emitted > 0) {
        files += 1;
        matches += matched.lines.length;
      }
      if (stop !== null) break;
      if (matches >= SEARCH_CAPS.maxMatches) {
        stop = 'matches';
        break;
      }
    }

    if (rows.length === 0) {
      return { content: `No matches for '${request.pattern}'.`, display: { summary: 'no match' } };
    }
    // summarizeSearch closes every result with what was found and which ceiling, if any, cut it —
    // so a truncated search can never be read as a complete one.
    const notice = summarizeSearch({
      stop,
      matches,
      files,
      outputMode: request.outputMode,
      contextLines: request.contextLines,
      caps: SEARCH_CAPS,
      narrowed: request.glob !== null,
    });
    // The same two numbers the model's closing notice carries, and the same honesty about a ceiling:
    // in "paths" mode a match IS a file, so counting matches there would say the same thing twice.
    const found =
      request.outputMode === 'paths'
        ? `${files} file${files === 1 ? '' : 's'} matched`
        : `${matches} match${matches === 1 ? '' : 'es'} in ${files} file${files === 1 ? '' : 's'}`;
    return {
      content: [...rows, notice].join('\n'),
      display: { summary: stop === null ? found : `${found} (cut at the ${stop} cap)` },
    };
  },
};
