// git_branch — create, switch and list branches inside the project repo. Host-side like every git
// tool (the root sandbox ships no git).
//
// This is what carries the one-branch-per-task convention: the Worker puts itself on the task's
// branch before it writes code, and the Reviewer commits onto whatever branch it finds. Nothing here
// deletes a branch, and nothing reaches outside the project repo.
//
// The two mutating actions treat a dirty working tree differently, on purpose:
// - `create` is allowed on a dirty tree — `git checkout -b` carries uncommitted work onto the new
//   branch intact, so branching late costs nothing.
// - `switch` to an existing branch is REFUSED on a dirty tree, because the work would either block
//   the checkout or ride onto a branch it does not belong to. The model commits or shelves first.
// `create` on a branch that already exists is therefore a switch, and inherits the switch rule.

import {
  branchNameError,
  createBranch,
  listBranches,
  switchBranch,
} from '../core/session/project-git-branch.js';
import type { JsonObject, ToolModule, ToolResult } from './types.js';
import { toolError } from './types.js';

export const GIT_BRANCH = 'git_branch';

const ACTIONS = ['create', 'switch', 'list'] as const;
type BranchAction = (typeof ACTIONS)[number];

function isAction(value: unknown): value is BranchAction {
  return typeof value === 'string' && (ACTIONS as readonly string[]).includes(value);
}

export const gitBranchTool: ToolModule = {
  name: GIT_BRANCH,
  description:
    'Work with branches in the project repo. `create` makes a branch and checks it out — if it already ' +
    'exists you simply move onto it, so re-running is safe; `switch` moves to an existing branch; `list` ' +
    'shows every branch and which one you are on. Creating carries your uncommitted work onto the new ' +
    'branch, but switching to an existing branch is refused while the working tree is dirty — commit or ' +
    'shelve first.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'One of "create", "switch", "list".',
      },
      name: {
        type: 'string',
        description:
          'The branch name, e.g. "task/epic-auth/01-hash-passwords". Required for create/switch, ' +
          'ignored by list.',
      },
    },
    required: ['action'],
  },

  async execute(ctx, args): Promise<ToolResult> {
    const action = args['action'];
    if (!isAction(action)) {
      return toolError(
        `'action' must be one of: ${ACTIONS.join(', ')}.`,
        'Call git_branch with action:"list" to see where you are.',
      );
    }

    const metadata: JsonObject = { project: ctx.projectName, action };

    if (action === 'list') {
      // listBranches: every local branch plus the checked-out one, so the model never infers it.
      const { branches, current } = listBranches(ctx.projectPath);
      return {
        content: { branches, current, detached: current === null },
        metadata: { ...metadata, count: branches.length, current },
      };
    }

    const rawName = args['name'];
    if (typeof rawName !== 'string' || rawName.trim() === '') {
      return toolError(`'name' is required for action "${action}".`, 'Name the branch, e.g. name:"task/01-add-hashing".');
    }
    const name = rawName.trim();
    // branchNameError rejects a leading '-' (the argv would read it as an option) and git's own
    // shorthand `@{...}` (it would resolve to a branch other than the one spelled), then defers to
    // `git check-ref-format` for the rest of the rules.
    const badName = branchNameError(ctx.projectPath, name);
    if (badName !== null) {
      return toolError(badName, 'Use letters, digits, "/", "-", "_" and "." — for example "task/01-add-hashing".');
    }

    const result = action === 'create' ? createBranch(ctx.projectPath, name) : switchBranch(ctx.projectPath, name);
    if (!result.ok) {
      const hint =
        result.error?.includes('uncommitted changes') === true
          ? 'Commit the work with commit_changes, or shelve it with git_stash, then switch.'
          : 'Call git_branch with action:"list" to see what exists.';
      return {
        content: { error: result.error ?? 'git branch operation failed.', hint },
        exitStatus: -1,
        error: result.error ?? 'git branch operation failed.',
        metadata: { ...metadata, branch: name },
      };
    }

    const content: JsonObject = {
      branch: result.branch,
      current: result.branch,
      created: action === 'create' && !result.existed,
      existed: result.existed,
    };
    if (action === 'create' && result.existed) {
      content['note'] = `'${result.branch}' already existed — you are now on it, nothing was created.`;
    }
    return { content, metadata: { ...metadata, branch: result.branch, existed: result.existed } };
  },
};
