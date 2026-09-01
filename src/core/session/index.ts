// core/session/ — session orchestrator, per-phase isolated memory, and config.
export * from './config.js';
// V5/02: host-global app state (~/.local-ai-developer/state.json) — the persisted `/models use` choice.
export type { AppState } from './app-state.type.js';
export { loadAppState } from './load-app-state.js';
export { saveAppState } from './save-app-state.js';
// Boot model resolution against what Ollama actually has installed (replaces the old hard-coded default).
export type { ChatRole } from './memory.js';
export { SessionMemory } from './memory.js';
export { SessionOrchestrator } from './orchestrator.js';
export { resolveBootModel } from './resolve-boot-model.js';
// Phase memory is SQLite-backed (projects/<active>/.orchestrator/memory.db): a context is an
// addressable, titled row rather than a file whose name had to be renamed to change state.
export { appendAuditRow, OUTPUT_PREVIEW_LIMIT } from './audit.js';
export type { ToolCallRecord, DispatchDeps } from './dispatch.js';
export { dispatchToolCall } from './dispatch.js';
export { CONTEXT_TITLE_LIMIT, generateContextTitle } from './generate-context-title.js';
export { CONTEXT_SHORT_ID_LEN, shortContextId } from './memory-db.js';
export type { ClearResult, ContextSummary, MemoryRecord, MemoryRole, PhaseLoad, TurnTokens } from './memory-db.type.js';
export type { TurnContext } from './turn-loop.js';
export { MAX_TOOL_ROUNDS } from './turn-loop.js';
// The ONE place a finished tool call is recorded: its durable audit row AND its `←` scrollback line.
// Every audit-writing site goes through it — including the three runner-level refusals that never
// reach the dispatcher, which are exactly the calls the record was built to make visible.
export { appendJsonlLine } from './append-jsonl-line.js';
export { recordToolCall } from './record-tool-call.js';
export { shortSubagentId } from './short-subagent-id.js';
// Questions the user skipped during an ask_user round (V6/01) — durable, re-asked by /questions, and
// delivered back to the phase that asked on its next turn.
export { allTasks } from './all-tasks.js';
export { answerQuestion } from './answer-question.js';
export type { AnsweredQuestion } from './answered-question.type.js';
export { BacklogError } from './backlog-error.js';
export { backlogRoot, BACKLOG_DIRNAME } from './backlog-root.js';
export type { Backlog } from './backlog.type.js';
export { drainAnsweredQuestions } from './drain-answered-questions.js';
export { appendEvent } from './events-log.js';
export type { OrchestratorEvent, OrchestratorEventInput, OrchestratorEventType } from './events-log.type.js';
export { evictStaleToolResults, KEEP_RECENT_TOOL_RESULTS } from './evict-stale-tool-results.js';
export type { EvictionRewrite } from './evict-stale-tool-results.type.js';
export { findTask } from './find-task.js';
export { formatEvictedStub } from './format-evicted-stub.js';
export { isEvictableTool } from './is-evictable-tool.js';
export { levelDocs } from './level-docs.js';
export { nextRunnableTasks } from './next-runnable-tasks.js';
export type { PendingQuestion } from './pending-question.type.js';
export type { QuestionRow } from './question-row.type.js';
export { readBacklog } from './read-backlog.js';
export { readPendingQuestions } from './read-pending-questions.js';
export { saveUnansweredQuestions } from './save-unanswered-questions.js';
export { setTaskStatus } from './set-task-status.js';
export { taskSkipReason } from './task-skip-reason.js';
export type { TaskStatus } from './task-status.type.js';
export { TASK_STATUSES } from './task-statuses.js';
export type { Task } from './task.type.js';
export type { WorkerDeps, WorkerResult } from './worker-runner.js';
export { runWorkerTask } from './worker-runner.js';
// REVIEWER_TOOL_NAMES now lives with every other phase's array in phases/phase-tool-names.ts.
export type { ChangedFiles } from './capture-changed-files.js';
export { captureChangedFiles } from './capture-changed-files.js';
export type { CommitResult } from './commit-paths.js';
export { commitPaths } from './commit-paths.js';
export { diffPaths } from './diff-paths.js';
export { dropTaskStash } from './drop-task-stash.js';
export { isWorkingTreeDirty } from './is-working-tree-dirty.js';
export type { ChangedPaths } from './list-changed-paths.js';
export { listChangedPaths } from './list-changed-paths.js';
export { readTaskStashDiff } from './read-task-stash-diff.js';
export type { ReviewDecision } from './review-decision.type.js';
export { REVIEW_DIFF_BUDGET } from './review-diff-budget.js';
export type { ReviewIssue } from './review-issue.type.js';
export type { ReviewVerdict } from './review-verdict.type.js';
export type { ReviewerDeps, ReviewerInput, ReviewerOutcome, ReviewerCommit } from './reviewer-runner.js';
export { runReviewerTask, ReviewerVerdictError } from './reviewer-runner.js';
export type { GitRun } from './run-git.js';
export { runGit } from './run-git.js';
export { runTaskLoop, MAX_ROUNDS } from './run-task-loop.js';
export type { TaskLoopResult, TaskLoopOutcome, TaskLoopDeps, TaskLoopReporter } from './run-task-loop.type.js';
export { SEVERITIES } from './severities.js';
export type { Severity } from './severity.type.js';
export { stashTaskAttempt } from './stash-task-attempt.js';
export type { VerdictGitState } from './verdict-git-conflict.js';
export { verdictGitConflict } from './verdict-git-conflict.js';
// The model-facing git operations behind git_stash / git_branch / git_push / git_inspect. The shelf
// prefix is deliberately disjoint from the task loop's `lad-stash:` — see shelf-label.ts and
// task-stash-label-prefix.ts.
export { branchExists } from './branch-exists.js';
export { branchNameError } from './branch-name-error.js';
export type { BranchResult } from './branch-result.type.js';
export { createBranch } from './create-branch.js';
export { currentBranch } from './current-branch.js';
export { dropShelf } from './drop-shelf.js';
export { inspectDiff } from './inspect-diff.js';
export { DEFAULT_LOG_COUNT, MAX_LOG_COUNT } from './inspect-log-count.js';
export { inspectLog } from './inspect-log.js';
export type { InspectResult } from './inspect-result.type.js';
export { inspectShow } from './inspect-show.js';
export { isValidShelfLabel } from './is-valid-shelf-label.js';
export type { BranchList } from './list-branches.js';
export { listBranches } from './list-branches.js';
export type { Shelf } from './list-shelves.js';
export { listShelves } from './list-shelves.js';
export { popShelf } from './pop-shelf.js';
export type { PushResult } from './push-current-branch.js';
export { pushCurrentBranch } from './push-current-branch.js';
export { refError } from './ref-error.js';
export { saveShelf } from './save-shelf.js';
export { shelfLabelError } from './shelf-label-error.js';
export { SHELF_LABEL_PREFIX } from './shelf-label.js';
export type { ShelfResult } from './shelf-result.type.js';
export { switchBranch } from './switch-branch.js';
// The branch a task is developed on — one task, one branch (docs/phases.md).
export { runBatch, batchSummaryFileName, BATCHES_DIRNAME } from './batch.js';
export { taskBranchName } from './task-branch-name.js';
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
export type { BlockerRow } from './blocker-row.type.js';
export { openBlockerForTask } from './open-blocker-for-task.js';
export { raiseBlocker } from './raise-blocker.js';
export type { RaisedBlocker } from './raised-blocker.type.js';
export { readBlockerRows } from './read-blocker-rows.js';
export { resolveBlocker } from './resolve-blocker.js';
export type { ResolvedBlocker } from './resolved-blocker.type.js';
export { spawnRetro, RetroError } from './retro-runner.js';
export type { RetroInput, RetroResult, RetroScope, RetroDeps, RetroSubmission } from './retro-runner.type.js';
export { rulesPhasesDirty } from './rules-phases-dirty.js';
export { RunStopSignal } from './run-stop-signal.js';
export type { StopScope } from './run-stop-signal.type.js';
// Model-to-model deliberation (backlog/model-to-model-dialogue.md): challenger ⇄ proponent on throwaway
// contexts, distilled by a third — one model, three windows, none of them in any phase's memory.
export { parseDebateDigest } from './parse-debate-digest.js';
export { runDebate, MAX_DEBATE_ROUNDS } from './run-debate.js';
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
