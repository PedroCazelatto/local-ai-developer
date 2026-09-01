// Assemble the Reviewer's seed: the task, the diff of what the Worker changed, and the contract it
// must satisfy before its verdict will be accepted.

import type { ReviewerInput } from './reviewer-input.type.js';
import type { Task } from './task.type.js';
import { COMMIT_CHANGES } from '../../tools/commit-changes.js';
import { LIST_CHANGES } from '../../tools/list-changes.js';
import { MARK_TASK_DONE } from '../../tools/mark-task-done.js';
import { RAISE_BLOCKER, validateBlockerRequest } from '../../tools/raise-blocker.js';
import { SUBMIT_VERDICT, parseVerdict } from '../../tools/submit-verdict.js';

/** Assemble the seed user message: the task + the Worker's summary/diff/test results + review orders. */
export function buildReviewerSeed(input: ReviewerInput): string {
  const { task, workerSummary, changedFiles, testResults } = input;
  const changed = changedFiles.trim()
    ? `\n${changedFiles.trim()}`
    : ' — not captured; inspect the working tree yourself with list_changes / list_files / read_file.';
  const tests = testResults.trim()
    ? `\n${testResults.trim()}`
    : ' — not captured; re-run the tests yourself with run_in_project before deciding.';

  return `Review the Worker's attempt at ONE task. Judge it on BOTH axes — behavior (does it satisfy the task, including edge cases?) and standards (architecture, naming, testing conventions) — then submit ONE verdict.

## Task under review: ${task.title}
(backlog id: ${task.id})

${task.body}

## Worker's change summary
${workerSummary.trim() || '(the Worker left no summary)'}

## Changed files${changed}

## Test results the Worker reported${tests}

How to review:
- Do NOT trust the summary alone — read the changed files and the tests, and reason about correctness + edge cases.
- When in doubt, re-run the tests/build with run_in_project rather than trusting the transcript.
- You inspect with read_file, search_in_files, list_files, run_in_project and execute_command. You CANNOT edit files — the Worker does that.
- You are the one who commits. The Worker cannot commit anything, so nothing reaches the project history unless you put it there.

Committing this review:
- Call ${LIST_CHANGES} to see every uncommitted file, then ${COMMIT_CHANGES} to commit the ones you accept. You may commit PARTIALLY: take the files that are right and leave the rest.
- Keep each commit as small as it can be without breaking the project — commit one coherent change at a time, not the whole tree in one call.
- EVERY file you leave uncommitted goes back to the Worker, so every one of them needs an issue naming it and saying what to fix. A verdict that leaves a file unexplained is rejected.
- If the task is complete: call ${MARK_TASK_DONE}, commit the backlog file it changes, and make sure NOTHING is left uncommitted before you pass.

- When done, call ${SUBMIT_VERDICT} EXACTLY ONCE. result "pass" only if BOTH axes pass AND you committed everything AND the task is marked done; any blocker/major issue means "fail"; every issue must be concrete and name the offending file + fix direction. Do not call any tool after ${SUBMIT_VERDICT}.
- A "fail" with an empty working tree is fine and normal: it means everything the Worker wrote was good, but the task still needs work that does not exist yet. Say what is missing in your issues.
- If the TASK ITSELF is unjudgeable — ambiguous, under-specified, self-contradictory, or conflicting with the architecture — call ${RAISE_BLOCKER} with a precise question INSTEAD of a verdict, immediately. That is for a broken task, not for code that is merely wrong (a wrong-code case is a "fail" verdict with fix feedback).`;
}
