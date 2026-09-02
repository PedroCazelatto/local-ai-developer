// list_files (V1/03) — lists the entries of a directory in the active project. The walk happens
// INSIDE the sandbox, on the same tree mounted at /workspace, and never follows a symlink.
//
// It takes a `path` and a `depth`. It used to take neither, and the cost of that was not obvious: the
// three planning phases have no shell on purpose, so with a root-only, non-recursive listing they
// could not enumerate a subdirectory AT ALL. What they were pushed into instead — search_in_files for
// a string they hope is unique to the files they want, or read_file on a guessed path — costs far
// more window than the listing would have.
//
// `depth` defaults to 1, so the plain call behaves exactly as it always did. Recursion is opt-in
// because a recursive listing is where the cost is: the answer is bounded at MAX_ENTRIES rows and
// says so when it truncates, on the same rule as read_file's notice — a cut listing must never look
// like a complete one, or the model concludes a file does not exist and writes it a second time.

import { buildIgnoreFilter } from './build-ignore-filter.js';
import { messageOf } from './fs-support.js';
import { listWorkspaceEntries } from './list-workspace-entries.js';
// readOptionalCount: null when the model omitted the argument, the integer when it is one, and a
// recoverable message when it is a string, a fraction, or below the floor.
import { readOptionalCount } from './read-optional-count.js';
import { renderFileTree } from './render-file-tree.js';
// Validates the path under the project root (throws on escape) and returns it /workspace-relative.
import { scopeToWorkspace } from './scope-to-workspace.js';
import { toolError } from './tool-error.js';
import type { ToolModule } from './tool-module.type.js';
import type { ToolResult } from './tool-result.type.js';

/** Entries one call may print. The bound is rows, not depth — see the tool description. */
const MAX_ENTRIES = 500;
/** One level, i.e. the contents of the named directory and nothing below it. */
const DEFAULT_DEPTH = 1;

export const listFilesTool: ToolModule = {
  name: 'list_files',
  description:
    'List the files and directories of the project, as an indented tree. `path` selects a subdirectory ' +
    '(default: the project root) and `depth` says how many levels below it to include (default 1 — the ' +
    `directory's own contents). Entries ignored by the project's .gitignore are not shown. At most ` +
    `${MAX_ENTRIES} entries per call; a truncated listing says how many it left out.`,
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Directory to list, relative to the project root. Defaults to the project root.',
      },
      depth: {
        type: 'integer',
        description:
          'How many levels below `path` to include. 1 (the default) lists that directory only; 2 also ' +
          'lists the contents of its subdirectories, and so on.',
        default: DEFAULT_DEPTH,
      },
    },
    required: [],
  },

  async execute(ctx, args): Promise<ToolResult> {
    const rawPath = args['path'];
    if (rawPath !== undefined && typeof rawPath !== 'string') {
      return toolError("'path' must be a string if provided.");
    }
    const requested = typeof rawPath === 'string' && rawPath.trim() !== '' ? rawPath.trim() : '.';

    const depth = readOptionalCount(args['depth'], 'depth', 1);
    if (!depth.ok) return toolError(depth.error);

    // scopeToWorkspace: checks the path host-side (`..`, absolute) AND container-side (a symlink the
    // host cannot see), returning the /workspace-relative posix path to list.
    const scopedPath = await scopeToWorkspace(ctx, requested);
    if (!scopedPath.ok) return toolError(scopedPath.error);
    const scoped = scopedPath.relative;

    // listWorkspaceEntries: one `find` in the sandbox, returning project-root-relative paths and
    // marking real directories — a symlink is reported as a leaf and is never descended.
    const listing = await listWorkspaceEntries(ctx.sandbox, scoped, depth.value ?? DEFAULT_DEPTH);
    if (!listing.ok) {
      return listing.notFound
        ? toolError(`Directory '${requested}' not found.`)
        : toolError(`Error listing '${requested}': ${listing.message}`);
    }

    // buildIgnoreFilter: the project's own .gitignore, or SKIP_DIRS when it has none. `.git/` always.
    const isIgnored = await buildIgnoreFilter(ctx.sandbox);
    const visible = listing.entries.filter((entry) => !isIgnored(entry));
    if (visible.length === 0) {
      const empty = scoped === '' || scoped === '.' ? 'The project is empty.' : `'${requested}' is empty.`;
      return { content: empty, display: { summary: 'empty' } };
    }

    // renderFileTree: indents by depth, files before directories, and applies the cap in that same
    // depth-first order so a truncated tree never leaves a row without its parent.
    const tree = renderFileTree(visible, scoped, MAX_ENTRIES);
    const rows = [...tree.rows];
    if (tree.omitted > 0) {
      rows.push('', `... ${tree.omitted} more entries not shown (cap: ${MAX_ENTRIES}).`);
    }
    // The scrollback line counts what the model was actually shown, and says so when the cap cut the
    // listing — a truncated tree must not read as a complete one there either.
    const shown = tree.rows.length;
    const summary = tree.omitted > 0 ? `${shown} of ${shown + tree.omitted} entries` : `${shown} entries`;
    return { content: rows.join('\n'), display: { summary } };
  },
};
