// Worker runner (V1/10) — spawns a FRESH, ISOLATED Worker window per task: an empty messages array
// seeded with the Worker system prompt (rules/phases/worker.md via V1/01) + a user message carrying
// the task definition and a slice of PRODUCT_SPEC.md. Runs the tool-dispatch loop (streaming to the
// REPL, every call audited), returns the Worker's summary, then the window is DISCARDED — no
// cross-task carryover (V1 has no persisting fix loop; that's V3).

import { buildSystemPrompt, loadPhasePrompt } from '../../context/index.js';
import { createToolContext } from '../../tools/index.js';
import { truncateHeadTail } from '../../tools/index.js';
import type { SandboxClient } from '../container/index.js';
import type { OllamaClient, Message, StreamHandle, TokenCounts, Tool, ToolCall } from '../llm/index.js';
import { appendAuditRow } from './audit.js';
import { dispatchToolCall } from './dispatch.js';
import { processMessage } from './turn-loop.js';
import type { TurnContext } from './turn-loop.js';
import type { Task } from './types.js';

// A test-first implement loop (write test → run → implement → run → summarize) needs more rounds
// than an interactive chat turn, so give the Worker generous headroom before the loop cap trips.
const WORKER_MAX_ROUNDS = 24;

export interface WorkerDeps {
  readonly llm: OllamaClient;
  readonly tools: Tool[];
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
 * A single Worker window implementing the turn loop's TurnContext against its OWN messages array —
 * isolated from the session's per-phase histories (Foundation/06) and from other tasks. Tool calls
 * dispatch through the shared registry and are audited as phase "worker".
 */
class WorkerWindow implements TurnContext {
  readonly activePhase = 'worker';
  readonly messages: Message[];
  /** The last assistant turn with no tool calls — the Worker's summary to the user. */
  summary = '';
  /** The Worker's last run_in_project invocation (command + output tail), for the Reviewer's seed. */
  lastTestRun: string | null = null;

  constructor(private readonly deps: WorkerDeps, systemPrompt: string) {
    this.messages = [{ role: 'system', content: systemPrompt }];
  }

  streamAsk(userInput: string): StreamHandle {
    this.messages.push({ role: 'user', content: userInput });
    return this.deps.llm.stream(this.messages, this.deps.tools);
  }

  streamContinue(): StreamHandle {
    return this.deps.llm.stream(this.messages, this.deps.tools);
  }

  onTokens(_tokens: TokenCounts): void {
    // The Worker window's size isn't shown in the session status line; nothing to track here.
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
    const ctx = createToolContext({
      projectName: this.deps.projectName,
      projectPath: this.deps.projectPath,
      sandbox: this.deps.sandbox,
      phase: 'worker',
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
}

/** Assemble the seed user message: the task definition + the spec slice + the Worker's marching orders. */
function buildWorkerSeed(task: Task, specSlice: string): string {
  const deps = task.dependsOn.length > 0 ? task.dependsOn.join(', ') : 'none';
  return `You are implementing ONE task from the backlog. Implement exactly this task, test-first — no more, no less.

## Task: ${task.title}
(backlog id: ${task.id})

${task.body}

Depends on: ${deps}
${specSlice ? `\n${specSlice}\n` : ''}
Rules for this task:
- Write FAILING tests first, then the minimum code to pass them.
- Run tests/builds/installs with run_in_project (the project's own container); use execute_command for plain shell. Never touch the host.
- Write and edit files with write_file / edit_file.
- When finished, end with a plain-text SUMMARY for the user: files touched, tests added, assumptions made, and anything surprising. Do not call a tool in that final turn.`;
}

/**
 * Spawn a fresh Worker window for `task`, run it to completion (streaming to the REPL, all tool
 * calls audited), and return its summary. The window is discarded when this resolves.
 */
export async function runWorkerTask(deps: WorkerDeps, task: Task, specSlice: string): Promise<WorkerResult> {
  const systemPrompt = buildSystemPrompt(loadPhasePrompt('worker'), `Project: ${deps.projectName}`);
  const window = new WorkerWindow(deps, systemPrompt);
  await processMessage(window, buildWorkerSeed(task, specSlice), WORKER_MAX_ROUNDS);
  return { summary: window.summary, lastTestRun: window.lastTestRun };
}
