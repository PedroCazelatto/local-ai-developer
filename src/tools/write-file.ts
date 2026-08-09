// write_file (V1/03) — creates or overwrites a UTF-8 file under the project root, creating parent
// directories automatically (the Worker writes src/foo/bar.ts into a fresh project — missing this
// breaks scaffolding).
//
// The write happens INSIDE the sandbox. Bytes cross as a tar stream over Docker's archive endpoint,
// never as a shell command, so file content is never interpolated into `sh -c` and there is no
// quoting rule for a model's file to break. The parent chain is carried as directory members of that
// same archive, which is what replaced the old host-side recursive mkdir.
//
// `ctx.resolve` still runs first, as the scoping check: a path that leaves the project is refused
// here with a message the model can act on, before anything reaches the container.

import { messageOf } from './fs-support.js';
// Validates the path under the project root (throws on escape) and returns it /workspace-relative.
import { scopeToWorkspace } from './scope-to-workspace.js';
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
    // scopeToWorkspace: checks the path host-side (`..`, absolute) AND container-side (a symlink the
    // host cannot see), returning the /workspace-relative posix path the transport wants.
    const scoped = await scopeToWorkspace(ctx, relative);
    if (!scoped.ok) return toolError(scoped.error);
    if (scoped.relative === '') {
      return toolError(`Error writing '${relative}': it is the project root, not a file.`);
    }

    const written = await ctx.sandbox.writeWorkspaceFile(scoped.relative, Buffer.from(content, 'utf-8'));
    if (!written.ok) {
      return toolError(`Error writing '${relative}': ${written.message}`);
    }
    return `Wrote ${content.length} characters to '${relative}'.`;
  },
};
