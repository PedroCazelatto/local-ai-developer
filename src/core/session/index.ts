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
// The ONE place a finished tool call is recorded: its durable audit row AND its `←` scrollback line.
// Every audit-writing site goes through it — including the three runner-level refusals that never
// reach the dispatcher, which are exactly the calls the record was built to make visible.
export { recordToolCall } from './record-tool-call.js';
export { shortSubagentId } from './short-subagent-id.js';
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
export { evictStaleToolResults, KEEP_RECENT_TOOL_RESULTS } from './evict-stale-tool-results.js';
export type { EvictionRewrite } from './evict-stale-tool-results.type.js';
export { isEvictableTool } from './is-evictable-tool.js';
export { formatEvictedStub } from './format-evicted-stub.js';
// REVIEWER_TOOL_NAMES now lives with every other phase's array in phases/phase-tool-names.ts.
export { runReviewerTask, ReviewerVerdictError } from './reviewer-runner.js';
export type { ReviewerDeps, ReviewerInput, ReviewerOutcome, ReviewerCommit } from './reviewer-runner.js';
export { verdictGitConflict } from './verdict-git-conflict.js';
export type { VerdictGitState } from './verdict-git-conflict.js';
export { runTaskLoop, MAX_ROUNDS } from './run-task-loop.js';
export type { TaskLoopResult, TaskLoopOutcome, TaskLoopDeps, TaskLoopReporter } from './run-task-loop.type.js';
export type { ReviewVerdict, ReviewIssue, Severity, ReviewDecision } from './types.js';
export { SEVERITIES } from './types.js';
export { isWorkingTreeDirty } from './is-working-tree-dirty.js';
export { captureChangedFiles } from './capture-changed-files.js';
export type { ChangedFiles } from './capture-changed-files.js';
export { listChangedPaths } from './list-changed-paths.js';
export type { ChangedPaths } from './list-changed-paths.js';
export { diffPaths } from './diff-paths.js';
export { commitPaths } from './commit-paths.js';
export type { CommitResult } from './commit-paths.js';
export { stashTaskAttempt } from './stash-task-attempt.js';
export { readTaskStashDiff } from './read-task-stash-diff.js';
export { dropTaskStash } from './drop-task-stash.js';
export { REVIEW_DIFF_BUDGET } from './review-diff-budget.js';
export { runGit } from './run-git.js';
export type { GitRun } from './run-git.js';
// The model-facing git operations behind git_stash / git_branch / git_push / git_inspect. The shelf
// prefix is deliberately disjoint from the task loop's `lad-stash:` — see shelf-label.ts and
// task-stash-label-prefix.ts.
export { saveShelf } from './save-shelf.js';
export { listShelves } from './list-shelves.js';
export type { Shelf } from './list-shelves.js';
export { popShelf } from './pop-shelf.js';
export { dropShelf } from './drop-shelf.js';
export { isValidShelfLabel } from './is-valid-shelf-label.js';
export { shelfLabelError } from './shelf-label-error.js';
export { SHELF_LABEL_PREFIX } from './shelf-label.js';
export type { ShelfResult } from './types.js';
export { createBranch } from './create-branch.js';
export { switchBranch } from './switch-branch.js';
export { listBranches } from './list-branches.js';
export type { BranchList } from './list-branches.js';
export { branchExists } from './branch-exists.js';
export { currentBranch } from './current-branch.js';
export { branchNameError } from './branch-name-error.js';
export type { BranchResult } from './types.js';
export { pushCurrentBranch } from './push-current-branch.js';
export type { PushResult } from './push-current-branch.js';
export { inspectDiff } from './inspect-diff.js';
export { inspectLog } from './inspect-log.js';
export { inspectShow } from './inspect-show.js';
export { refError } from './ref-error.js';
export { DEFAULT_LOG_COUNT, MAX_LOG_COUNT } from './inspect-log-count.js';
export type { InspectResult } from './types.js';
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
