// git_push — publish the checked-out branch to `origin`. Host-side like every git tool (the root
// sandbox ships no git).
//
// It takes NO arguments, and that is the guardrail: always the branch you are on, always `origin`,
// always with `-u`, never a force. There is no refspec, no remote and no flag for a model to get
// wrong, and no way to overwrite history on the remote.
//
// The one distinction that matters: a branch missing on the remote is CREATED by the push (that is
// how a task branch first gets there), but a missing REPOSITORY is an error. The model never creates
// a GitHub repository — it reports back and the user creates it.
//
// Withheld from the Worker, which has no commits of its own to publish (the Reviewer commits).

import { pushCurrentBranch } from '../core/session/push-current-branch.js';
import type { JsonObject } from './json-object.type.js';
import type { ToolModule } from './tool-module.type.js';
import type { ToolResult } from './tool-result.type.js';

export const GIT_PUSH = 'git_push';

export const gitPushTool: ToolModule = {
  name: GIT_PUSH,
  description:
    'Push the branch you are on to the remote, setting its upstream. Takes no arguments: it always ' +
    'pushes the current branch to "origin" and never force-pushes. If the branch is not on the remote ' +
    'yet, this creates it. If the remote repository does not exist you cannot create it — the call ' +
    'fails and you tell the user to create it. Push only when the user asked for it.',
  parameters: { type: 'object', properties: {} },

  async execute(ctx): Promise<ToolResult> {
    // pushCurrentBranch: `git push -u origin <current branch>`, never forced. Returns a structured
    // reason for every failure — detached HEAD, no `origin`, or a remote repository that isn't there.
    const result = pushCurrentBranch(ctx.projectPath);
    const metadata: JsonObject = { project: ctx.projectName, branch: result.branch };

    if (!result.ok) {
      const error = result.error ?? 'git push failed.';
      const content: JsonObject = result.hint === undefined ? { error } : { error, hint: result.hint };
      return { content, exitStatus: -1, error, metadata };
    }

    const content: JsonObject = {
      pushed: true,
      branch: result.branch,
      remote: 'origin',
      created_remote_branch: result.createdRemoteBranch,
      up_to_date: result.upToDate,
    };
    return {
      content,
      metadata: { ...metadata, created_remote_branch: result.createdRemoteBranch, up_to_date: result.upToDate },
      display: {
        summary: result.upToDate
          ? `already up to date · ${result.branch ?? 'the current branch'}`
          : `pushed ${result.branch ?? 'the current branch'} → origin${result.createdRemoteBranch ? ' (new remote branch)' : ''}`,
      },
    };
  },
};
