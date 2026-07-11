// core/session/ — session orchestrator, per-phase isolated memory, and config.
export * from './config.js';
export { SessionOrchestrator } from './orchestrator.js';
export { SessionMemory } from './memory.js';
export type { ChatRole } from './memory.js';
export { MAX_TOOL_ROUNDS } from './turn-loop.js';
export type { TurnContext } from './turn-loop.js';
export { dispatchToolCall } from './dispatch.js';
export type { ToolCallRecord, DispatchDeps } from './dispatch.js';
export { appendAuditRow, OUTPUT_PREVIEW_LIMIT } from './audit.js';
export {
  readBacklog,
  setTaskStatus,
  nextRunnableTasks,
  allTasks,
  findTask,
  levelDocs,
  backlogRoot,
  BACKLOG_DIRNAME,
  BacklogError,
} from './backlog.js';
export type { Backlog, Task, TaskStatus } from './types.js';
export { TASK_STATUSES } from './types.js';
export { runWorkerTask } from './worker-runner.js';
export type { WorkerDeps, WorkerResult } from './worker-runner.js';
export { runReviewerTask, ReviewerVerdictError, REVIEWER_TOOL_NAMES } from './reviewer-runner.js';
export type { ReviewerDeps, ReviewerInput, ReviewerOutcome } from './reviewer-runner.js';
export type { ReviewVerdict, ReviewIssue, Severity, ReviewDecision } from './review-types.js';
export { SEVERITIES } from './review-types.js';
export { isWorkingTreeDirty, captureChangedFiles, commitPaths, REVIEW_DIFF_BUDGET } from './project-git.js';
export type { ChangedFiles, CommitResult } from './project-git.js';
export { buildCommitMessage } from './commit-message.js';
export type { CommitMessageInput } from './commit-message.js';
