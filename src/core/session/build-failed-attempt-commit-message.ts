// The message for the commit that records a failed attempt in a task's frontmatter. Its own file for
// the same reason build-retro-commit-message.ts is: the wording lands in the project's git log, where
// a human reads it long after the run, so it is reviewed in one place rather than inline at the call.
//
// No human name anywhere in it (constitution: never write the user's name into any file in this repo).
// It also states no round count: an escalation can end at round 1 (nothing changed, or no verdict) as
// easily as at round 5, and a message that guessed would be wrong on the short paths.

/** The convention message for the escalation commit — what changed, why, and how to retry the task. */
export function buildFailedAttemptCommitMessage(taskId: string): string {
  const subject = `docs(task ${taskId}): record the failed attempt`;
  const body = [
    'The execution loop ended this task without a passing review.',
    '',
    'The status is now `failed`, so an unattended `/run all` passes over the task instead of spending',
    `another five rounds on it. To retry the task from scratch, run \`/run ${taskId}\`.`,
  ];
  return [subject, '', ...body].join('\n');
}
