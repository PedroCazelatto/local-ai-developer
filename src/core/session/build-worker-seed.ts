// Assemble the Worker's seed: the task definition, its level docs, and the test-first contract.

import type { Task } from './task.type.js';
import { taskBranchName } from './task-branch-name.js';

/** Assemble the seed user message: the task definition + the spec slice + the Worker's marching orders. */
export function buildWorkerSeed(task: Task, specSlice: string): string {
  const deps = task.dependsOn.length > 0 ? task.dependsOn.join(', ') : 'none';
  // taskBranchName: the one-branch-per-task name, derived mechanically from the backlog id + title.
  // Handing the Worker the exact string means nothing downstream has to guess it — a later fix round
  // or a re-run names the same branch, and git_branch's create-or-switch makes repeating it harmless.
  const branch = taskBranchName(task);
  return `You are implementing ONE task from the backlog. Implement exactly this task, test-first — no more, no less.

## Task: ${task.title}
(backlog id: ${task.id})

${task.body}

Depends on: ${deps}
${specSlice ? `\n${specSlice}\n` : ''}
Rules for this task:
- FIRST, before anything else, put yourself on this task's branch: git_branch(action:"create", name:"${branch}"). One task is one branch. If the branch already exists you simply move onto it — expected on a later round or a re-run, and nothing is lost.
- Write FAILING tests first, then the minimum code to pass them.
- Run tests/builds/installs with run_in_project (the project's own container); use execute_command for plain shell. Never touch the host.
- Write and edit files with write_file / edit_file.
- You do NOT commit. Leave your work in the working tree — the Reviewer commits every file it accepts and hands the rest back to you with notes.
- When finished, end with a plain-text SUMMARY for the user: files touched, tests added, assumptions made, and anything surprising. Do not call a tool in that final turn.`;
}
