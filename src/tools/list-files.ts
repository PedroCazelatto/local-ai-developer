// list_files (V1/03) — ported from tools/list_files.py. Lists the entries of the active project
// root, creating the root first if it does not exist (so a brand-new project lists cleanly). No
// params. Host-side; the tree is the same one mounted at /workspace.

import { existsSync, mkdirSync, readdirSync } from 'node:fs';

import { messageOf } from './fs-support.js';
import type { ToolModule, ToolResult } from './types.js';
import { toolError } from './types.js';

export const listFilesTool: ToolModule = {
  name: 'list_files',
  description: 'List all files and directories in the project root.',
  parameters: { type: 'object', properties: {}, required: [] },

  async execute(ctx): Promise<ToolResult> {
    try {
      if (!existsSync(ctx.projectPath)) {
        mkdirSync(ctx.projectPath, { recursive: true });
      }
      const files = readdirSync(ctx.projectPath);
      return files.length > 0 ? files.join('\n') : 'The project is empty.';
    } catch (err) {
      return toolError(`Error listing files: ${messageOf(err)}`);
    }
  },
};
