// The tool-dispatch turn loop (port of main.py's _run_turn / _process_message). One TURN =
// stream one assistant message, then dispatch any tool calls it issued. processMessage runs the
// first turn, then continues turn-after-turn until the model stops calling tools, bounded by
// MAX_TOOL_ROUNDS so a confused model can't spin forever.
//
// The loop drives the UI (renderer + spinner) and the orchestrator through the TurnContext seam
// (SessionOrchestrator implements it), so this file stays free of Ollama/sandbox details.

import type { Message, StreamHandle, TokenCounts, ToolCall, TurnAbortReason } from '../llm/index.js';
import { TurnAbortedError } from '../llm/index.js';
import { activityLine } from '../ui/activity-line.js';
import { inputFence } from '../ui/input-fence.js';
import { printToolCall } from '../ui/print-tool-call.js';
import { renderer } from '../ui/renderer.js';
import { statusActivity } from '../ui/status-activity.js';
import type { MarkdownStream } from '../ui/types.js';

/** Exact value ported from main.py — caps the implement/continue rounds per user message. */
export const MAX_TOOL_ROUNDS = 8;

/** What the turn loop needs from the orchestrator. Keeps the loop decoupled from its internals. */
export interface TurnContext {
  readonly activePhase: string;
  /**
   * Optional failsafe hook run BEFORE each model call (V4/05). The orchestrator uses it to compact an
   * over-threshold phase's history synchronously, so the imminent call streams on the shrunken view.
   * Absent for spawned windows (Worker/Reviewer/Retro) — they have no persisted history to compact.
   */
  beforeModelCall?(): Promise<void>;
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
  /**
   * Dispatch one tool call; returns a string result, recoverable errors included. The ONE thing it
   * throws is a TurnAbortedError from a tool that was itself running a model call (a sub-agent's turn,
   * search_rules' one-shot, a debate round) — a cancel there is an instruction about the whole turn, not
   * a tool failure for the model to read and reason about. See dispatch.ts.
   */
  callTool(name: string, args: Record<string, unknown>): Promise<string>;
  /**
   * Optional: a spawned window that reaches a terminal state mid-turn (e.g. the Reviewer captured
   * its verdict via submit_verdict) returns true here to stop the loop immediately, instead of
   * running another turn. Absent/false for the interactive phases and the Worker.
   */
  isComplete?(): boolean;
  /**
   * Optional: the turn was cancelled or timed out, and `partial` is whatever the model had produced when
   * the stream was cut. The interactive phases implement it to keep that partial turn on disk and branch
   * the whole exchange off the live history, so the prompt can be rewritten. Spawned windows leave it
   * absent — their history dies with the window the abort is tearing down anyway.
   */
  onAborted?(reason: TurnAbortReason, partial: Message): void;
}

/**
 * Run turns for one user message until the model stops calling tools (or the cap is hit). The cap
 * defaults to MAX_TOOL_ROUNDS for interactive phases; the Worker (V1/10) passes a larger value
 * since a test-first implement loop (write test → run → implement → run) needs more headroom.
 */
export async function processMessage(
  ctx: TurnContext,
  userInput: string,
  maxRounds: number = MAX_TOOL_ROUNDS,
): Promise<void> {
  // Mark a turn in flight so the status line (V5/03) can show the live thinking/elapsed field, and
  // always clear it — even if a stream throws mid-turn — so idle never shows a stuck "thinking".
  statusActivity.turnStarted();
  // inputFence.begin: pin the fenced `›` box above the status bar for the length of the turn and take
  // stdin, so typing mid-turn lands in that row instead of echoing into the reply. Reentrant — a
  // sub-agent's nested processMessage shares the one fence — and always released in the finally.
  inputFence.begin();
  // Whatever the model had produced when a turn was cut, carried out here so that EVERY way an exchange
  // can be aborted — mid-stream, or inside a tool call that is itself running a model (a sub-agent's
  // turn, search_rules' one-shot, a debate round) — rolls back through the one path below. Two rollback
  // sites would be two things to keep in step; there is one.
  const cut: AbortedTurn = { message: { role: 'assistant', content: '' } };
  try {
    if (!(await runTurn(ctx, () => ctx.streamAsk(userInput), cut))) {
      return; // no tool calls on the first turn → done
    }
    for (let round = 0; round < maxRounds; round++) {
      if (!(await runTurn(ctx, () => ctx.streamContinue(), cut))) {
        return; // model finished
      }
    }
    renderer.systemMessage(`⚠ Reached tool-call limit (${maxRounds}). Stopping.`);
  } catch (err) {
    // The interactive phases branch the whole exchange off their live history here; spawned windows
    // leave the hook absent and simply unwind. Anything that is not an abort passes straight through.
    if (err instanceof TurnAbortedError) ctx.onAborted?.(err.reason, cut.message);
    throw err;
  } finally {
    statusActivity.turnEnded();
    inputFence.end();
  }
}

/** Carries the partial assistant message from whichever turn was cut out to the rollback. */
interface AbortedTurn {
  message: Message;
}

/**
 * Stream one assistant turn and dispatch any tool calls. Returns true if tool calls were
 * dispatched (caller should run another turn), false otherwise.
 */
async function runTurn(ctx: TurnContext, start: () => StreamHandle, cut: AbortedTurn): Promise<boolean> {
  // Run any pre-call failsafe (V4/05 summarization) BEFORE the user turn is added / the stream opens,
  // so the imminent call runs on the compacted history. A no-op for spawned windows (hook absent).
  await ctx.beforeModelCall?.();
  activityLine.show(); // transient "thinking" line; hidden the moment visible text streams
  const handle = start();

  // Stream filtered, visible deltas incrementally, rendered as markdown: each delta prints raw the
  // instant it arrives, and every completed line is repainted formatted. The stream is opened on the
  // FIRST visible delta (never before) so the spinner can't interleave with model text and a pure
  // tool-call turn prints no orphan prefix.
  let stream: MarkdownStream | null = null;
  try {
    for await (const delta of handle.deltas) {
      if (!delta) continue;
      if (stream === null) {
        activityLine.hide();
        stream = renderer.assistantStream();
      }
      stream.push(delta);
    }
  } catch (err) {
    // A cancelled or timed-out turn lands here. Close the UI down exactly as a completed turn would —
    // the half-written line is real output the user watched arrive, and the append-only rule means it
    // stays — then record what was produced so processMessage's rollback can keep it. handle.result()
    // is readable after an abort precisely so this is possible (see StreamHandle).
    activityLine.hide();
    stream?.end();
    if (err instanceof TurnAbortedError) cut.message = handle.result().message;
    throw err;
  }
  activityLine.hide(); // covers a turn with no visible prose (e.g. a pure tool-call turn)
  stream?.end(); // renders a trailing line the model left unterminated; no-op if nothing streamed

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
    // printToolCall: `→ <tool> <the argument that names what it did>` — the path, the command, the
    // pattern — fitted to the terminal and styled by the theme. Printed BEFORE the call runs, so the
    // record is on screen while the work happens; its `←` result line comes from the audit sink.
    printToolCall(name, args);
    // Surface the executing tool + a live elapsed timer on the transient activity line; always clear it
    // when the call returns (or throws — callTool never throws, but be defensive) so the line is gone
    // the instant the tool finishes.
    statusActivity.toolStarted(name);
    activityLine.show();
    try {
      const result = await ctx.callTool(name, args);
      ctx.addToolResult(name, result);
    } finally {
      statusActivity.toolEnded();
      activityLine.hide();
    }
  }
  // A spawned window can signal it reached its terminal result during this turn's tool calls (the
  // Reviewer captured its verdict) — stop now rather than prompting for another turn.
  if (ctx.isComplete?.()) {
    return false;
  }
  return true;
}
