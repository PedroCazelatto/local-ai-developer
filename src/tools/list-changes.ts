// list_changes — the uncommitted-file set of the active project repo. Host-side, like every other git
// action: the root sandbox is a slim base image that ships NO git, so `execute_command "git status"`
// cannot work and the model has no other way to see what it has changed. Deliberately returns paths
// only, never a diff — a phase that wants content calls read_file on the file it cares about, so a
// large working tree can't quietly consume num_ctx.
//
// This is the companion to commit_changes: you cannot name the paths to commit without first seeing
// what changed, and the Reviewer re-reads it after each partial commit to see what is still outstanding.

import { listChangedPaths } from '../core/session/list-changed-paths.js';
import type { JsonObject, ToolModule, ToolResult } from './types.js';

export const LIST_CHANGES = 'list_changes';

export const listChangesTool: ToolModule = {
  name: LIST_CHANGES,
  description:
    'List every uncommitted change in the project repo (modified, added, deleted and untracked files), ' +
    'as project-relative paths with their git status codes. Call this before commit_changes to see what ' +
    'you can commit, and after a commit to see what is still outstanding. Returns paths only — use ' +
    'read_file for content.',
  parameters: { type: 'object', properties: {} },

  async execute(ctx): Promise<ToolResult> {
    // listChangedPaths: `git status --porcelain -uall` against the project repo on the host, parsed
    // into project-relative paths (renames keep the new path). No file content is read.
    const { status, files } = listChangedPaths(ctx.projectPath);
    const content: JsonObject = {
      clean: files.length === 0,
      count: files.length,
      files,
      status,
    };
    return {
      content,
      metadata: { project: ctx.projectName, count: files.length },
      display: { summary: files.length === 0 ? 'clean' : `${files.length} changed file${files.length === 1 ? '' : 's'}` },
    };
  },
};
