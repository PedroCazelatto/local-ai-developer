// edit_file (V1/03) — ported from tools/edit_file.py. Replaces an exact string that must appear
// EXACTLY ONCE; no change if it is missing or matches more than once (the model must add context to
// disambiguate). Host-side, path-scoped. Replacement is literal — done by index splice, never
// String.replace, so `$`-sequences in new_string are not reinterpreted.

import { readFileSync, writeFileSync } from 'node:fs';

import { codeOf, decodeUtf8Strict, messageOf } from './fs-support.js';
import type { ToolModule, ToolResult } from './types.js';
import { toolError } from './types.js';

/** Count non-overlapping occurrences of `needle` in `haystack` (matches Python str.count semantics). */
function countOccurrences(haystack: string, needle: string): number {
  if (needle === '') return 0;
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

export const editFileTool: ToolModule = {
  name: 'edit_file',
  description:
    "Replace an exact string in an existing file. The 'old_string' must appear exactly once — if it is missing or matches multiple times, no change is made. Use this for small, targeted edits instead of rewriting the whole file.",
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path relative to the project root.' },
      old_string: {
        type: 'string',
        description: 'Exact text to find. Must match verbatim, including whitespace.',
      },
      new_string: { type: 'string', description: 'Text that replaces old_string.' },
    },
    required: ['path', 'old_string', 'new_string'],
  },

  async execute(ctx, args): Promise<ToolResult> {
    const relative = args['path'];
    const oldString = args['old_string'];
    const newString = args['new_string'];
    if (typeof relative !== 'string') {
      return toolError("'path' must be a string.");
    }
    if (typeof oldString !== 'string' || typeof newString !== 'string') {
      return toolError("'old_string' and 'new_string' must be strings.");
    }
    if (oldString === newString) {
      return toolError("'old_string' and 'new_string' are identical — nothing to do.");
    }
    let resolved: string;
    try {
      resolved = ctx.resolve(relative);
    } catch (err) {
      return toolError(messageOf(err));
    }

    let original: string;
    try {
      original = decodeUtf8Strict(readFileSync(resolved));
    } catch (err) {
      if (codeOf(err) === 'ENOENT') {
        return toolError(`File '${relative}' not found.`);
      }
      if (err instanceof TypeError) {
        return toolError(`File '${relative}' is not valid UTF-8 text.`);
      }
      return toolError(`Error reading '${relative}': ${messageOf(err)}`);
    }

    const occurrences = countOccurrences(original, oldString);
    if (occurrences === 0) {
      return toolError(`'old_string' not found in '${relative}'.`);
    }
    if (occurrences > 1) {
      return toolError(
        `'old_string' matches ${occurrences} times in '${relative}'. Provide more surrounding context to make it unique.`,
      );
    }

    const index = original.indexOf(oldString);
    const updated = original.slice(0, index) + newString + original.slice(index + oldString.length);
    try {
      writeFileSync(resolved, updated, 'utf-8');
    } catch (err) {
      return toolError(`Error writing '${relative}': ${messageOf(err)}`);
    }
    return `Edited '${relative}'.`;
  },
};
