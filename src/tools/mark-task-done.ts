// mark_task_done — the Reviewer's phase-scoped tool for flipping the task under review to
// `status: done` in its own backlog file. Deliberately NOT in the global registry (registry.ts): only
// the spawned Reviewer window offers it, and it takes no arguments — it always means "the task I am
// reviewing", so the Reviewer cannot close a task it was never handed.
//
// It exists so the Reviewer can own the status flip WITHOUT owning general write access: its tool list
// still has no write_file/edit_file, so it can mark a task done but cannot quietly patch the Worker's
// code and then pass its own edit. The flip only becomes real when the Reviewer commits the backlog
// file with commit_changes — marking without committing leaves the tree dirty, which blocks a `pass`.

import type { Tool } from 'ollama';

/** The one name the Reviewer window special-cases to flip its task's backlog status. */
export const MARK_TASK_DONE = 'mark_task_done';

/** The Ollama tool definition appended to the Reviewer's tool list (alongside submit_verdict). */
export const markTaskDoneTool: Tool = {
  type: 'function',
  function: {
    name: MARK_TASK_DONE,
    description:
      'Mark the task you are reviewing as done in its backlog file. Takes no arguments — it always means ' +
      'the task under review. Call it ONLY when the work is complete and you are about to pass, then ' +
      'commit the backlog file it changed with commit_changes before calling submit_verdict. A "pass" ' +
      'is rejected unless the task is marked done and the working tree is clean.',
    parameters: { type: 'object', properties: {} },
  },
};
