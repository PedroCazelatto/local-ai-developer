// read_file (V1/03) — reads a UTF-8 text file from the ACTIVE PROJECT. The read happens INSIDE the
// sandbox: bytes come back over Docker's archive endpoint, the same tree execute_command sees at
// /workspace. Nothing here opens a host file handle, so a symlink planted inside the project cannot
// pull a host file into the window — a link is an exfiltration path in, not just a write path out.
// `ctx.resolve` still runs first as the scoping check, giving an escaping path a clean recoverable
// message rather than a container-shaped one. Error strings are the Python's, with the leading
// `Error: ` folded into the structured { error } shape (V1/02).
//
// The answer is BOUNDED and NUMBERED, like every other output path here. This is the tool the model
// reaches for most, and it was the one that could hand a 900-line file to a Worker whose whole window
// is 16k. The cap is the default rather than a flag, because a cap the model must opt into never
// fires; the numbers are what let it come back for a range instead of the file.

import { formatReadNotice } from './format-read-notice.js';
import { decodeUtf8Strict, messageOf } from './fs-support.js';
import { readOptionalCount } from './read-optional-count.js';
import { READ_FILE_CHAR_LIMIT, READ_FILE_LINE_LIMIT, renderNumberedSlice } from './render-numbered-slice.js';
import { scopeToWorkspace } from './scope-to-workspace.js';
import type { JsonObject, ToolModule, ToolResult } from './types.js';
import { toolError } from './types.js';

export const readFileTool: ToolModule = {
  name: 'read_file',
  description:
    'Read a UTF-8 text file from the project (path relative to the project root). Output is line-numbered ' +
    `(\`  12→code\`), and bounded: at most ${READ_FILE_LINE_LIMIT} lines or ` +
    `${READ_FILE_CHAR_LIMIT.toLocaleString('en-US')} characters, whichever runs out first. Every result ends ` +
    "with the range it showed and the file's total length, so a cut file never looks like a short one. When " +
    'you already know which part of a file you need, read only that part with `offset` and `limit` rather ' +
    'than paying for the whole file.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path relative to the project root.' },
      offset: {
        type: 'integer',
        description:
          'How many lines to skip before the first line shown. 0 (the default) starts at the top of the file; ' +
          'line N is at offset N-1, and the notice on a truncated read tells you the offset to continue from.',
        default: 0,
      },
      limit: {
        type: 'integer',
        description: `How many lines to show. Defaults to ${READ_FILE_LINE_LIMIT}, which is also the maximum — a larger value is clamped, not honoured.`,
        default: READ_FILE_LINE_LIMIT,
      },
      char_offset: {
        type: 'integer',
        description:
          'Only for a line too long to show at once. Starts the FIRST line shown at this character instead ' +
          'of at its beginning, and that line is then numbered `12+5000→`. Leave it at 0 unless a notice ' +
          'told you to use it.',
        default: 0,
      },
    },
    required: ['path'],
  },

  async execute(ctx, args): Promise<ToolResult> {
    const path = args['path'];
    if (typeof path !== 'string') {
      return toolError("'path' must be a string.");
    }
    // readOptionalCount: null when the model omitted the argument, the integer when it is one, and a
    // recoverable message when it is a string, a fraction, or below the floor.
    const offset = readOptionalCount(args['offset'], 'offset', 0);
    if (!offset.ok) return toolError(offset.error);
    const limit = readOptionalCount(args['limit'], 'limit', 1);
    if (!limit.ok) return toolError(limit.error);
    const charOffset = readOptionalCount(args['char_offset'], 'char_offset', 0);
    if (!charOffset.ok) return toolError(charOffset.error);

    // scopeToWorkspace: checks the path on BOTH sides of the boundary — host-side for `..` and an
    // absolute escape, container-side for a symlink the host cannot see — and returns what is left as
    // the /workspace-relative posix path the sandbox wants.
    const scoped = await scopeToWorkspace(ctx, path);
    if (!scoped.ok) return toolError(scoped.error);
    const relative = scoped.relative;

    // The bytes come out of the CONTAINER, never off the host: readWorkspaceFile pulls them over
    // Docker's archive endpoint, so a symlink planted in the project can only point somewhere else
    // inside a container that never had the host mounted.
    const read = await ctx.sandbox.readWorkspaceFile(relative);
    if (!read.ok) {
      return read.notFound
        ? toolError(`File '${path}' not found.`)
        : toolError(`Error reading '${path}': ${read.message}`);
    }
    if (read.kind === 'directory') {
      return toolError(`Error reading '${path}': it is a directory, not a file.`);
    }

    let text: string;
    try {
      text = decodeUtf8Strict(read.bytes);
    } catch (err) {
      if (err instanceof TypeError) {
        // TextDecoder fatal mode throws a TypeError on an invalid UTF-8 sequence.
        return toolError(`File '${path}' is not valid UTF-8 text.`);
      }
      return toolError(`Error reading '${path}': ${messageOf(err)}`);
    }

    // renderNumberedSlice: numbers the requested window of lines and stops at the line cap or the
    // character cap, whichever runs out first; it refuses only a starting point past the end of the
    // file, or past the end of the line `char_offset` is aimed into.
    const slice = renderNumberedSlice(text, offset.value ?? 0, limit.value, charOffset.value ?? 0);
    if (!slice.ok) {
      return slice.past === 'end-of-file'
        ? toolError(
            `'offset' ${offset.value ?? 0} is past the end of '${path}' (${slice.totalLines} lines).`,
            `Valid offsets are 0 to ${slice.totalLines - 1}.`,
          )
        : toolError(
            `'char_offset' ${charOffset.value ?? 0} is past the end of line ${slice.lineNumber} of '${path}' (${slice.lineLength} characters).`,
            `Read the next line instead: offset: ${slice.lineNumber}.`,
          );
    }

    // The window has now SEEN this file, which is what write_file and edit_file check before they
    // change it (tools/guard-write-target.ts). Recorded against the file's FULL bytes, not the slice
    // shown: a bounded read still tells the model what the file is, and hashing only the visible
    // window would call every large file stale the moment it was read with a different offset.
    ctx.readTracker.record(path, read.bytes);

    // formatReadNotice: the trailing `[showed lines A-B of N …]` line, present on every read, naming
    // which cap fired and the offset that continues from here.
    const notice = formatReadNotice(slice, path);
    const metadata: JsonObject = {
      path,
      firstLine: slice.firstLine,
      lastLine: slice.lastLine,
      totalLines: slice.totalLines,
      charOffset: slice.charOffset,
      stoppedBy: slice.stoppedBy,
      cutMidLine: slice.cutMidLine,
    };
    return { content: slice.text === '' ? notice : `${slice.text}\n\n${notice}`, metadata };
  },
};
