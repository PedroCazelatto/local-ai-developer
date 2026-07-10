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
export type { WorkerDeps } from './worker-runner.js';
