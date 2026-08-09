// edit_file (V1/03) — ported from tools/edit_file.py. Replaces an exact string that must appear
// EXACTLY ONCE; no change if it is missing or matches more than once (the model must add context to
// disambiguate). Replacement is literal — done by index splice, never String.replace, so
// `$`-sequences in new_string are not reinterpreted.
//
// Read-modify-write, all three steps against the CONTAINER: the file comes back over Docker's
// archive endpoint, the splice happens here, and the result goes back the same way. `ctx.resolve`
// runs first as the scoping check. Not atomic, and deliberately not pretending to be — nothing else
// is writing the project while a phase holds the turn (docs/product.md, no parallelism).

import { decodeUtf8Strict, messageOf } from './fs-support.js';
// Validates the path under the project root (throws on escape) and returns it /workspace-relative.
import { scopeToWorkspace } from './scope-to-workspace.js';
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
    // scopeToWorkspace: checks the path host-side (`..`, absolute) AND container-side (a symlink the
    // host cannot see), returning the /workspace-relative posix path the transport wants.
    const scoped = await scopeToWorkspace(ctx, relative);
    if (!scoped.ok) return toolError(scoped.error);

    const read = await ctx.sandbox.readWorkspaceFile(scoped.relative);
    if (!read.ok) {
      return read.notFound
        ? toolError(`File '${relative}' not found.`)
        : toolError(`Error reading '${relative}': ${read.message}`);
    }
    if (read.kind === 'directory') {
      return toolError(`Error reading '${relative}': it is a directory, not a file.`);
    }

    let original: string;
    try {
      original = decodeUtf8Strict(read.bytes);
    } catch (err) {
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
    const written = await ctx.sandbox.writeWorkspaceFile(scoped.relative, Buffer.from(updated, 'utf-8'));
    if (!written.ok) {
      return toolError(`Error writing '${relative}': ${written.message}`);
    }
    return `Edited '${relative}'.`;
  },
};
