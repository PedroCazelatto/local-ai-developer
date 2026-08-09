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
// Phase memory is SQLite-backed (projects/<active>/.orchestrator/memory.db): a context is an
// addressable, titled row rather than a file whose name had to be renamed to change state.
export { CONTEXT_SHORT_ID_LEN, shortContextId } from './memory-db.js';
export type { ClearResult, ContextSummary, MemoryRecord, MemoryRole, PhaseLoad, TurnTokens } from './memory-db.type.js';
export { CONTEXT_TITLE_LIMIT, generateContextTitle } from './generate-context-title.js';
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
// REVIEWER_TOOL_NAMES now lives with every other phase's array in phases/phase-tool-names.ts.
export { runReviewerTask, ReviewerVerdictError } from './reviewer-runner.js';
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
export { runGit } from './run-git.js';
export type { GitRun } from './run-git.type.js';
// The model-facing git operations behind git_stash / git_branch / git_push / git_inspect. The shelf
// prefix is deliberately disjoint from project-git.ts's task-keyed `lad-stash:` — see
// project-git-stash.ts.
export { saveShelf, listShelves, popShelf, dropShelf, isValidShelfLabel, shelfLabelError, SHELF_LABEL_PREFIX } from './project-git-stash.js';
export type { Shelf, ShelfResult } from './project-git-stash.type.js';
export { createBranch, switchBranch, listBranches, branchExists, currentBranch, branchNameError } from './project-git-branch.js';
export type { BranchList, BranchResult } from './project-git-branch.type.js';
export { pushCurrentBranch } from './project-git-push.js';
export type { PushResult } from './project-git-push.type.js';
export { inspectDiff, inspectLog, inspectShow, refError, DEFAULT_LOG_COUNT, MAX_LOG_COUNT } from './project-git-inspect.js';
export type { InspectResult } from './project-git-inspect.type.js';
// The branch a task is developed on — one task, one branch (docs/phases.md).
export { taskBranchName } from './task-branch-name.js';
export { runBatch, batchSummaryFileName, BATCHES_DIRNAME } from './batch.js';
export type {
  BatchSummary,
  BatchDeps,
  BatchReporter,
  BatchPosition,
  BatchPassed,
  BatchEscalated,
  BatchBlocked,
  BatchCancelled,
  BatchSkipped,
} from './batch.type.js';
// The `/stop` wind-down request behind `/stop` and `/stop round`: armed by the input fence for the
// length of a run, read by the task loop between rounds and by the batch driver between tasks.
export { RunStopSignal } from './run-stop-signal.js';
export type { StopScope } from './run-stop-signal.type.js';
export { rulesPhasesDirty } from './rules-phases-dirty.js';
export { raiseBlocker, resolveBlocker, openBlockerForTask, readBlockerRows } from './blocker-store.js';
export type { RaisedBlocker, ResolvedBlocker, BlockerRow } from './blocker-store.type.js';
export { spawnRetro, RetroError } from './retro-runner.js';
export type { RetroInput, RetroResult, RetroScope, RetroDeps, RetroSubmission } from './retro-runner.type.js';
// Model-to-model deliberation (backlog/model-to-model-dialogue.md): challenger ⇄ proponent on throwaway
// contexts, distilled by a third — one model, three windows, none of them in any phase's memory.
export { runDebate, MAX_DEBATE_ROUNDS } from './run-debate.js';
export { parseDebateDigest } from './parse-debate-digest.js';
export type {
  DebateRequest,
  DebateRole,
  DebateTurn,
  DebateDigest,
  DebateDeps,
  DebateFailure,
  DebateOutcome,
} from './run-debate.type.js';
export { SubagentManager, SUBAGENT_TOOL_NAMES, SUBAGENT_SHORT_ID_LEN } from './subagents.js';
export type {
  SubagentInfo,
  SubagentState,
  SubagentDeps,
  SubagentHandle,
  SubagentSpawnResult,
  SubagentAskOutcome,
} from './subagents.type.js';
