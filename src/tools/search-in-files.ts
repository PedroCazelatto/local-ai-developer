// search_in_files (V1/03) — LITERAL substring search over the UTF-8 text files under the project root,
// case-INSENSITIVE by default. Host-side, scoped by ctx.resolve, skipping the heavy/generated trees
// (walk-project-files.ts). Optional filename glob. Forward-slash paths regardless of host OS.
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

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { findMatchingLines } from './find-matching-lines.js';
import { decodeUtf8Strict, globToRegExp, messageOf } from './fs-support.js';
import { parseSearchRequest } from './parse-search-request.js';
import { renderFileMatches } from './render-file-matches.js';
import type { SearchCaps, SearchStopReason } from './search-in-files.type.js';
import { summarizeSearch } from './summarize-search.js';
import type { ToolModule, ToolResult } from './types.js';
import { toolError } from './types.js';
import { walkProjectFiles } from './walk-project-files.js';

/**
 * The three ceilings, in one place. 300 output lines is roughly a fifth of a 16k window once the
 * system prompt is paid for — a search may inform a turn, it may not become the turn. The 200-match
 * cap is what this tool always had; 20 per file stops one hot file consuming the whole result and
 * starving the other files that also matched.
 */
export const SEARCH_CAPS: SearchCaps = {
  maxOutputLines: 300,
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

    let root: string;
    try {
      root = ctx.resolve('.');
    } catch (err) {
      return toolError(messageOf(err));
    }

    const globRe = request.glob !== null ? globToRegExp(request.glob) : null;
    // Fold the needle ONCE for the whole search; the per-file scan folds each line it tests.
    const needle = request.caseSensitive ? request.pattern : request.pattern.toLowerCase();

    const rows: string[] = [];
    let matches = 0;
    let files = 0;
    let stop: SearchStopReason = null;

    // walkProjectFiles yields every file under the root, depth-first, with .git/node_modules/dist/etc.
    // pruned — an unfiltered walk spends the whole match budget inside vendored code.
    for (const full of walkProjectFiles(root)) {
      if (globRe !== null && !globRe.test(path.basename(full))) continue;
      let text: string;
      try {
        text = decodeUtf8Strict(readFileSync(full));
      } catch {
        continue; // binary or unreadable — skipped silently, as the Python port did
      }
      const relative = path.relative(root, full).split(path.sep).join('/');

      if (request.outputMode === 'paths') {
        // One line per file and nothing else, so the first hit settles the file: no need to scan on,
        // and no need to split it into lines at all.
        const haystack = request.caseSensitive ? text : text.toLowerCase();
        if (!haystack.includes(needle)) continue;
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
      return `No matches for '${request.pattern}'.`;
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
    return [...rows, notice].join('\n');
  },
};
