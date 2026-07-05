// read_file (V1/03) — ported from tools/read_file.py. Reads a UTF-8 text file from the ACTIVE
// PROJECT, host-side (the orchestrator owns the host; the model never does), strictly scoped under
// the project root via ctx.resolve. The same tree is bind-mounted into the sandbox at /workspace,
// so a file read here is the same bytes execute_command / run_in_project see. Error strings are the
// Python's, with the leading `Error: ` folded into the structured { error } shape (V1/02).

import { readFileSync } from 'node:fs';

import { codeOf, decodeUtf8Strict, messageOf } from './fs-support.js';
import type { ToolModule, ToolResult } from './types.js';
import { toolError } from './types.js';

export const readFileTool: ToolModule = {
  name: 'read_file',
  description: 'Read a UTF-8 text file from the project (path relative to the project root) and return its contents.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path relative to the project root.' },
    },
    required: ['path'],
  },

  async execute(ctx, args): Promise<ToolResult> {
    const path = args['path'];
    if (typeof path !== 'string') {
      return toolError("'path' must be a string.");
    }
    let resolved: string;
    try {
      resolved = ctx.resolve(path);
    } catch (err) {
      return toolError(messageOf(err));
    }
    try {
      return decodeUtf8Strict(readFileSync(resolved));
    } catch (err) {
      if (codeOf(err) === 'ENOENT') {
        return toolError(`File '${path}' not found.`);
      }
      if (err instanceof TypeError) {
        // TextDecoder fatal mode throws a TypeError on an invalid UTF-8 sequence.
        return toolError(`File '${path}' is not valid UTF-8 text.`);
      }
      return toolError(`Error reading '${path}': ${messageOf(err)}`);
    }
  },
};
