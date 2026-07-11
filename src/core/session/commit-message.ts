// Accept-commit message builder (V2/03). One place for the project-repo commit convention, so the
// git log explains WHY a change landed. Format (confirmed default):
//
//   <type>(task <task-id>): <task title>
//
//   <Reviewer summary, 1–3 lines>
//   Reviewed-by: orchestrator (Reviewer phase) — verdict: pass
//
// No author / co-author trailer naming any human — the user's name must never be written into repo
// files or commit metadata (constitution). The trailer references the orchestrator/phase only.

export interface CommitMessageInput {
  /** Backlog id (path under backlog/ without ".md"), e.g. "epic-auth/story-signup/01-hash". */
  readonly taskId: string;
  readonly taskTitle: string;
  /** Conventional-commit type (feat/fix/chore/test/refactor); defaults to "feat" when blank. */
  readonly type: string;
  /** The Reviewer's verdict summary — carried into the body so the log records why it passed. */
  readonly reviewerSummary: string;
}

const REVIEWED_BY = 'Reviewed-by: orchestrator (Reviewer phase) — verdict: pass';

/** Assemble the convention-formatted commit message from the task + Reviewer verdict. */
export function buildCommitMessage(input: CommitMessageInput): string {
  const type = input.type.trim() === '' ? 'feat' : input.type.trim();
  const subject = `${type}(task ${input.taskId}): ${input.taskTitle}`.trim();
  const summary = input.reviewerSummary.trim();

  const lines: string[] = [subject, ''];
  if (summary !== '') lines.push(summary, '');
  lines.push(REVIEWED_BY);
  return lines.join('\n');
}
