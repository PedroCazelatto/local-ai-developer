// write_file (V1/03) — ported from tools/write_file.py. Creates or overwrites a UTF-8 file under
// the project root, creating parent directories automatically (the Worker writes src/foo/bar.ts
// into a fresh project — missing this breaks scaffolding). Host-side, path-scoped via ctx.resolve.

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { messageOf } from './fs-support.js';
import type { ToolModule, ToolResult } from './types.js';
import { toolError } from './types.js';

export const writeFileTool: ToolModule = {
  name: 'write_file',
  description:
    'Create or overwrite a text file in the project (path relative to the project root) with the given content. Parent directories are created automatically.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path relative to the project root.' },
      content: {
        type: 'string',
        description: 'Full file contents to write. Overwrites any existing file at this path.',
      },
    },
    required: ['path', 'content'],
  },

  async execute(ctx, args): Promise<ToolResult> {
    const relative = args['path'];
    const content = args['content'];
    if (typeof relative !== 'string') {
      return toolError("'path' must be a string.");
    }
    if (typeof content !== 'string') {
      return toolError("'content' must be a string.");
    }
    let resolved: string;
    try {
      resolved = ctx.resolve(relative);
    } catch (err) {
      return toolError(messageOf(err));
    }
    try {
      mkdirSync(path.dirname(resolved), { recursive: true });
      writeFileSync(resolved, content, 'utf-8');
      return `Wrote ${content.length} characters to '${relative}'.`;
    } catch (err) {
      return toolError(`Error writing '${relative}': ${messageOf(err)}`);
    }
  },
};
