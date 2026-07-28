// core/session/ — session orchestrator, per-phase isolated memory, and config.
export * from './config.js';
// V5/02: host-global app state (~/.local-ai-developer/state.json) — the persisted `/models use` choice.
export { loadAppState, saveAppState } from './app-state.js';
export type { AppState } from './app-state.type.js';
// Boot model resolution against what Ollama actually has installed (replaces the old hard-coded default).
export { resolveBootModel } from './resolve-boot-model.js';
export { SessionOrchestrator } from './orchestrator.js';
export { SessionMemory } from './memory.js';
export type { ChatRole } from './memory.js';
export type { ArchiveSummary, ClearResult, MemoryRecord, MemoryRole, PhaseLoad } from './memory-store.type.js';
export { MAX_TOOL_ROUNDS } from './turn-loop.js';
export type { TurnContext } from './turn-loop.js';
export { dispatchToolCall } from './dispatch.js';
export type { ToolCallRecord, DispatchDeps } from './dispatch.js';
export { appendAuditRow, OUTPUT_PREVIEW_LIMIT } from './audit.js';
export { appendJsonlLine } from './append-jsonl-line.js';
// Questions the user skipped during an ask_user round (V6/01) — durable, re-asked by /questions, and
// delivered back to the phase that asked on its next turn.
export {
  saveUnansweredQuestions,
  readPendingQuestions,
  answerQuestion,
  drainAnsweredQuestions,
} from './question-store.js';
export type { PendingQuestion, AnsweredQuestion, QuestionRow } from './question-store.type.js';
export { appendEvent } from './events-log.js';
export type { OrchestratorEvent, OrchestratorEventInput, OrchestratorEventType } from './events-log.type.js';
export {
  readBacklog,
  setTaskStatus,
  nextRunnableTasks,
  allTasks,
  findTask,
  taskSkipReason,
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
export type { ReviewerDeps, ReviewerInput, ReviewerOutcome, ReviewerCommit } from './reviewer-runner.js';
export { verdictGitConflict } from './verdict-git-conflict.js';
export type { VerdictGitState } from './verdict-git-conflict.type.js';
export { runTaskLoop, MAX_ROUNDS } from './run-task-loop.js';
export type { TaskLoopResult, TaskLoopOutcome, TaskLoopDeps, TaskLoopReporter } from './run-task-loop.type.js';
export type { ReviewVerdict, ReviewIssue, Severity, ReviewDecision } from './review-types.js';
export { SEVERITIES } from './review-types.js';
export {
  isWorkingTreeDirty,
  captureChangedFiles,
  listChangedPaths,
  diffPaths,
  commitPaths,
  stashTaskAttempt,
  readTaskStashDiff,
  dropTaskStash,
  REVIEW_DIFF_BUDGET,
} from './project-git.js';
export type { ChangedFiles, ChangedPaths, CommitResult } from './project-git.js';
export { runBatch, batchSummaryFileName, BATCHES_DIRNAME } from './batch.js';
export type {
  BatchSummary,
  BatchDeps,
  BatchReporter,
  BatchPosition,
  BatchPassed,
  BatchEscalated,
  BatchBlocked,
  BatchSkipped,
} from './batch.type.js';
export { rulesPhasesDirty } from './rules-phases-dirty.js';
export { raiseBlocker, resolveBlocker, openBlockerForTask, readBlockerRows } from './blocker-store.js';
export type { RaisedBlocker, ResolvedBlocker, BlockerRow } from './blocker-store.type.js';
export { spawnRetro, RetroError } from './retro-runner.js';
export type { RetroInput, RetroResult, RetroScope, RetroDeps, RetroSubmission } from './retro-runner.type.js';
export { SubagentManager, SUBAGENT_TOOL_NAMES, SUBAGENT_SHORT_ID_LEN } from './subagents.js';
export type {
  SubagentInfo,
  SubagentState,
  SubagentDeps,
  SubagentHandle,
  SubagentSpawnResult,
  SubagentAskOutcome,
} from './subagents.type.js';
