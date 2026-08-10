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

// Refuses an existing file this window has not read, or has read a now-stale copy of.
import { guardWriteTarget } from './guard-write-target.js';
// Validates the path under the project root (throws on escape) and returns it /workspace-relative.
import { scopeToWorkspace } from './scope-to-workspace.js';
import type { ToolModule, ToolResult } from './types.js';
import { toolError } from './types.js';

export const writeFileTool: ToolModule = {
  name: 'write_file',
  description:
    'Create or overwrite a text file in the project (path relative to the project root) with the given ' +
    'content. Parent directories are created automatically. Creating a NEW file is always allowed; ' +
    'OVERWRITING a file that already exists requires that you have read it first with read_file, and ' +
    'that it has not changed since — otherwise the write is refused and nothing is lost. Prefer ' +
    'edit_file for a change to an existing file: rewriting a whole file to alter part of it costs you ' +
    'its full length in output and risks dropping the parts you did not mean to touch.',
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

    // Read BEFORE writing, to tell a create from an overwrite. Creating is free — there is nothing to
    // have read, and gating it would break scaffolding into an empty project. Overwriting an existing
    // file is the most destructive thing the model can do and the one place a hallucinated file costs
    // most, so it goes through the same look-before-you-write guard edit_file uses.
    const existing = await ctx.sandbox.readWorkspaceFile(scoped.relative);
    if (!existing.ok && !existing.notFound) {
      return toolError(`Error writing '${relative}': ${existing.message}`);
    }
    if (existing.ok && existing.kind === 'directory') {
      return toolError(`Error writing '${relative}': it is a directory, not a file.`);
    }
    const previous = existing.ok && existing.kind === 'file' ? existing.bytes : null;
    if (previous !== null) {
      // guardWriteTarget: refuses an existing file this window never read, or read a now-stale copy of,
      // and says which of the two it is — "read it first" and "read it again" are different fixes.
      const guard = guardWriteTarget(ctx.readTracker, relative, previous);
      if (!guard.ok) return toolError(guard.error, guard.hint);
    }

    const bytes = Buffer.from(content, 'utf-8');
    const written = await ctx.sandbox.writeWorkspaceFile(scoped.relative, bytes);
    if (!written.ok) {
      return toolError(`Error writing '${relative}': ${written.message}`);
    }
    // The window has seen this file now — it wrote it. Without this a create followed by an edit_file
    // on the same path would be refused as unread.
    ctx.readTracker.record(relative, bytes);
    return previous === null
      ? `Created '${relative}' with ${content.length} characters.`
      : `Overwrote '${relative}' with ${content.length} characters.`;
  },
};
