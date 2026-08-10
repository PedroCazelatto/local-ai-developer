// Worker runner (V1/10) — spawns a FRESH, ISOLATED Worker window per task: an empty messages array
// seeded with the Worker system prompt (rules/phases/worker.md via V1/01) + a user message carrying
// the task definition and a slice of PRODUCT_SPEC.md. Runs the tool-dispatch loop (streaming to the
// REPL, every call audited), returns the Worker's summary, then the window is DISCARDED — no
// cross-task carryover (V1 has no persisting fix loop; that's V3).

import { buildSystemPrompt, loadPhasePrompt } from '../../context/index.js';
import { resolvePhaseTools } from '../../phases/index.js';
import { createToolContext } from '../../tools/index.js';
import { toolError, truncateHeadTail } from '../../tools/index.js';
import { COMMIT_CHANGES } from '../../tools/commit-changes.js';
import { GIT_PUSH } from '../../tools/git-push.js';
import { GIT_STASH } from '../../tools/git-stash.js';
import type { SandboxClient } from '../container/index.js';
import type { OllamaClient, Message, StreamHandle, TokenCounts, Tool, ToolCall } from '../llm/index.js';
import { addTokenCounts } from './add-token-counts.js';
import { appendAuditRow } from './audit.js';
import type { ToolCallRecord } from './dispatch.js';
import { dispatchToolCall } from './dispatch.js';
import { createReadTracker } from './read-tracker.js';
import type { FileReadTracker } from './read-tracker.type.js';
import { taskBranchName } from './task-branch-name.js';
import { processMessage } from './turn-loop.js';
import type { TurnContext } from './turn-loop.js';
import type { Task } from './types.js';

// A test-first implement loop (write test → run → implement → run → summarize) needs more rounds
// than an interactive chat turn, so give the Worker generous headroom before the loop cap trips.
// Exported so the V3/01 fix loop reuses the SAME per-round budget it grants each interactive pass.
export const WORKER_MAX_ROUNDS = 24;

export interface WorkerDeps {
  readonly llm: OllamaClient;
  readonly sandbox: SandboxClient;
  readonly projectName: string;
  readonly projectPath: string;
}

/** What one Worker window produces: its final summary + its last test/build run (for the Reviewer). */
export interface WorkerResult {
  /** The Worker's final no-tool-call turn — files touched, tests added, assumptions. */
  readonly summary: string;
  /**
   * The Worker's LAST run_in_project invocation (command + output tail), so V2/02 can seed the
   * Reviewer with the test results; null if the Worker ran none. The Reviewer may re-run regardless.
   */
  readonly lastTestRun: string | null;
}

/** Max chars of a captured run_in_project result carried to the Reviewer (it can re-run for more). */
const TEST_RUN_CAPTURE_LIMIT = 4000;

/**
 * The tools the Worker window refuses outright, each with the sentence the Worker is shown. These are
 * already absent from WORKER_TOOL_NAMES, so the model is never offered them — the refusal is the
 * second line of defense, because a model that recovers a tool call from bare JSON can name a tool it
 * was never offered.
 *
 * All three protect the same thing: the Reviewer's position as the gate between written code and the
 * git history. Committing its own work would make the Worker its own gatekeeper; stashing would let
 * it hide the work the Reviewer is about to judge; pushing publishes commits it did not make.
 */
const WORKER_REFUSALS: Readonly<Record<string, { readonly error: string; readonly hint: string }>> = {
  [COMMIT_CHANGES]: {
    error: 'the Worker cannot commit — the Reviewer commits the work it accepts.',
    hint: 'Finish the code and end with your SUMMARY. The Reviewer commits every file it accepts and returns the rest to you with notes.',
  },
  [GIT_STASH]: {
    error: 'the Worker cannot stash — your work must stay in the working tree for the Reviewer to judge.',
    hint: 'Leave the code where it is. If you need to move to another branch, git_branch with action:"create" carries your changes with you.',
  },
  [GIT_PUSH]: {
    error: 'the Worker cannot push — it has no commits of its own, because it does not commit.',
    hint: 'Finish the code and end with your SUMMARY. Publishing is not part of implementing a task.',
  },
};

/**
 * A single Worker window implementing the turn loop's TurnContext against its OWN messages array —
 * isolated from the session's per-phase histories (Foundation/06) and from other tasks. Tool calls
 * dispatch through the shared registry and are audited as phase "worker". Reused ACROSS the V3/01 fix
 * loop (created once per task, never reset between rounds); one class = one cohesive unit.
 */
export class WorkerWindow implements TurnContext {
  readonly activePhase = 'worker';
  readonly messages: Message[];
  /** The last assistant turn with no tool calls — the Worker's summary to the user. */
  summary = '';
  /** The Worker's last run_in_project invocation (command + output tail), for the Reviewer's seed. */
  lastTestRun: string | null = null;
  /** Running EXACT sum of every turn's tokens (a null metric poisons the sum — never estimated). */
  private tokenSum: TokenCounts = { promptTokens: 0, evalTokens: 0 };
  /** The Worker's allowlist from phase-tool-names.ts — notably without commit_changes (see callTool). */
  private readonly workerTools: Tool[];
  /**
   * What this window has read, backing the look-before-you-write guard on write_file/edit_file. One per
   * WorkerWindow, so it lives exactly as long as the window does — created once per task and kept
   * across all five fix rounds, like `messages`. That is deliberate: a read stays valid for as long as
   * the bytes do, and the Reviewer drives git between rounds, so what catches a file changing under the
   * Worker is the staleness half (a content hash), not an expiry.
   */
  private readonly readTracker: FileReadTracker = createReadTracker();

  constructor(private readonly deps: WorkerDeps) {
    // The Worker is the ONE phase that cannot commit: a Worker that commits its own code is its own
    // gatekeeper. It hands everything to the Reviewer, which commits what it accepts and returns the
    // rest with notes. WORKER_TOOL_NAMES omits commit_changes, git_stash and git_push so it cannot
    // see them at all, AND callTool refuses all three (WORKER_REFUSALS) — the registry is global, so
    // the definition list alone is not a guarantee.
    // Resolved BEFORE the prompt: buildSystemPrompt renders this same array into the "# Your Tools"
    // list, so the three absences are stated to the model rather than left as a silent gap.
    this.workerTools = resolvePhaseTools('worker');
    // The window builds its own system prompt from rules/phases/worker.md (V1/01), read fresh here.
    const systemPrompt = buildSystemPrompt(
      loadPhasePrompt('worker'),
      this.workerTools,
      `Project: ${deps.projectName}`,
    );
    this.messages = [{ role: 'system', content: systemPrompt }];
  }

  /** EXACT summed tokens across every turn of this window's whole life (all fix rounds). */
  get tokens(): TokenCounts {
    return this.tokenSum;
  }

  streamAsk(userInput: string): StreamHandle {
    this.messages.push({ role: 'user', content: userInput });
    return this.deps.llm.stream(this.messages, this.workerTools);
  }

  streamContinue(): StreamHandle {
    return this.deps.llm.stream(this.messages, this.workerTools);
  }

  onTokens(tokens: TokenCounts): void {
    // Sum exact counts across every turn so the V3/01 loop can report the Worker's whole-task cost.
    this.tokenSum = addTokenCounts(this.tokenSum, tokens);
  }

  addAssistant(content: string, toolCalls?: ToolCall[]): void {
    const entry: Message = { role: 'assistant', content };
    if (toolCalls && toolCalls.length > 0) {
      entry.tool_calls = toolCalls;
    } else {
      this.summary = content; // a no-tool-call turn is the Worker's final summary
    }
    this.messages.push(entry);
  }

  addToolResult(toolName: string, result: string): void {
    this.messages.push({ role: 'tool', content: result, tool_name: toolName });
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    // commit_changes / git_stash / git_push are global registry tools, so the dispatcher WOULD run
    // them if asked. Refuse them here (recoverable + audited) rather than relying on their absence
    // from the definitions — see WORKER_REFUSALS.
    const refusal = WORKER_REFUSALS[name];
    if (refusal !== undefined) {
      return this.refuse(name, args, refusal.error, refusal.hint);
    }
    const ctx = createToolContext({
      projectName: this.deps.projectName,
      projectPath: this.deps.projectPath,
      sandbox: this.deps.sandbox,
      phase: 'worker',
      llm: this.deps.llm, // backs ctx.oneShot for search_rules (V4/02)
      readTracker: this.readTracker, // this window's own; a sub-agent's reads never reach it
    });
    const result = await dispatchToolCall(ctx, name, args, {
      onToolCall: (record) => appendAuditRow(this.deps.projectPath, record),
    });
    // Remember the last test/build run so V2/02 can seed the Reviewer with the Worker's own results.
    if (name === 'run_in_project') {
      const command = typeof args['command'] === 'string' ? args['command'] : '';
      this.lastTestRun = `$ ${command}\n${truncateHeadTail(result, TEST_RUN_CAPTURE_LIMIT)}`;
    }
    return result;
  }

  /** Refuse a withheld tool with a recoverable message, and audit the attempt like any other call. */
  private refuse(name: string, args: Record<string, unknown>, message: string, hint: string): string {
    const err = toolError(message, hint);
    const output = typeof err.content === 'string' ? err.content : JSON.stringify(err.content);
    const record: ToolCallRecord = {
      ts: new Date().toISOString(),
      phase: 'worker',
      tool: name,
      args,
      exitStatus: -1,
      durationMs: 0,
      output,
      error: message,
    };
    appendAuditRow(this.deps.projectPath, record);
    return output;
  }
}

/** Assemble the seed user message: the task definition + the spec slice + the Worker's marching orders. */
export function buildWorkerSeed(task: Task, specSlice: string): string {
  const deps = task.dependsOn.length > 0 ? task.dependsOn.join(', ') : 'none';
  // taskBranchName: the one-branch-per-task name, derived mechanically from the backlog id + title.
  // Handing the Worker the exact string means nothing downstream has to guess it — a later fix round
  // or a re-run names the same branch, and git_branch's create-or-switch makes repeating it harmless.
  const branch = taskBranchName(task);
  return `You are implementing ONE task from the backlog. Implement exactly this task, test-first — no more, no less.

## Task: ${task.title}
(backlog id: ${task.id})

${task.body}

Depends on: ${deps}
${specSlice ? `\n${specSlice}\n` : ''}
Rules for this task:
- FIRST, before anything else, put yourself on this task's branch: git_branch(action:"create", name:"${branch}"). One task is one branch. If the branch already exists you simply move onto it — expected on a later round or a re-run, and nothing is lost.
- Write FAILING tests first, then the minimum code to pass them.
- Run tests/builds/installs with run_in_project (the project's own container); use execute_command for plain shell. Never touch the host.
- Write and edit files with write_file / edit_file.
- You do NOT commit. Leave your work in the working tree — the Reviewer commits every file it accepts and hands the rest back to you with notes.
- When finished, end with a plain-text SUMMARY for the user: files touched, tests added, assumptions made, and anything surprising. Do not call a tool in that final turn.`;
}

/**
 * Spawn a fresh Worker window for `task`, run it to completion (streaming to the REPL, all tool
 * calls audited), and return its summary. The window is discarded when this resolves.
 */
export async function runWorkerTask(deps: WorkerDeps, task: Task, specSlice: string): Promise<WorkerResult> {
  const window = new WorkerWindow(deps);
  await processMessage(window, buildWorkerSeed(task, specSlice), WORKER_MAX_ROUNDS);
  return { summary: window.summary, lastTestRun: window.lastTestRun };
}
