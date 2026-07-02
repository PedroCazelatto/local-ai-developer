// The tool-dispatch turn loop (port of main.py's _run_turn / _process_message). One TURN =
// stream one assistant message, then dispatch any tool calls it issued. processMessage runs the
// first turn, then continues turn-after-turn until the model stops calling tools, bounded by
// MAX_TOOL_ROUNDS so a confused model can't spin forever.
//
// The loop drives the UI (renderer + spinner) and the orchestrator through the TurnContext seam
// (SessionOrchestrator implements it), so this file stays free of Ollama/sandbox details.

import type { StreamHandle, TokenCounts, ToolCall } from '../llm/index.js';
import * as renderer from '../ui/renderer.js';
import { startThinking, stopThinking } from '../ui/spinner.js';

/** Exact value ported from main.py — caps the implement/continue rounds per user message. */
export const MAX_TOOL_ROUNDS = 8;

/** What the turn loop needs from the orchestrator. Keeps the loop decoupled from its internals. */
export interface TurnContext {
  readonly activePhase: string;
  /** Add the user message to memory, then start streaming the reply. */
  streamAsk(userInput: string): StreamHandle;
  /** Stream the next assistant turn from current memory WITHOUT injecting a user message. */
  streamContinue(): StreamHandle;
  /** Record the exact token counts from a completed turn. */
  onTokens(tokens: TokenCounts): void;
  /** Store an assistant turn (empty content when it carried tool calls — see runTurn). */
  addAssistant(content: string, toolCalls?: ToolCall[]): void;
  /** Store a tool result message. */
  addToolResult(toolName: string, result: string): void;
  /** Dispatch one tool call; returns a string result (recoverable errors included, never throws). */
  callTool(name: string, args: Record<string, unknown>): Promise<string>;
}

/** Run turns for one user message until the model stops calling tools (or the cap is hit). */
export async function processMessage(ctx: TurnContext, userInput: string): Promise<void> {
  if (!(await runTurn(ctx, () => ctx.streamAsk(userInput)))) {
    return; // no tool calls on the first turn → done
  }
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    if (!(await runTurn(ctx, () => ctx.streamContinue()))) {
      return; // model finished
    }
  }
  renderer.systemMessage(`⚠ Reached tool-call limit (${MAX_TOOL_ROUNDS}). Stopping.`);
}

/**
 * Stream one assistant turn and dispatch any tool calls. Returns true if tool calls were
 * dispatched (caller should run another turn), false otherwise.
 */
async function runTurn(ctx: TurnContext, start: () => StreamHandle): Promise<boolean> {
  startThinking();
  const handle = start();

  // Stream filtered, visible deltas incrementally. Stop the spinner + print the phase prefix on
  // the FIRST visible delta so the spinner never interleaves with model text.
  let shownPrefix = false;
  for await (const delta of handle.deltas) {
    if (!delta) continue;
    if (!shownPrefix) {
      stopThinking();
      renderer.assistantPrefix(ctx.activePhase);
      shownPrefix = true;
    }
    renderer.streamDelta(delta);
  }
  stopThinking(); // covers a turn with no visible prose (e.g. a pure tool-call turn)
  if (shownPrefix) {
    renderer.endAssistant(); // finalize the assistant block; else nothing visible was shown
  }

  // The client assembled the final structured message + exact tokens across the whole stream.
  const { message, tokens } = handle.result();
  ctx.onTokens(tokens);

  const content = message.content;
  const toolCalls = message.tool_calls;

  if (!toolCalls || toolCalls.length === 0) {
    ctx.addAssistant(content);
    return false;
  }

  // qwen2.5-coder's chat template renders assistant `content` XOR `tool_calls` (if/else), so a
  // stored turn holding BOTH drops the tool call on replay. Store empty content on purpose.
  ctx.addAssistant('', toolCalls);
  for (const call of toolCalls) {
    const name = call.function.name;
    const args = call.function.arguments;
    renderer.systemMessage(`→ tool: ${name}`);
    const result = await ctx.callTool(name, args);
    ctx.addToolResult(name, result);
  }
  return true;
}
