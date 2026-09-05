// Stream ONE assistant turn and dispatch any tool calls it made.
//
// AbortedTurn is the out-parameter that carries the partial assistant message from whichever turn was
// cut, back out to the rollback: a cancelled turn still said something, and the history has to record
// what the model had produced before the key press rather than pretending the turn never happened.

import type { Message, StreamHandle, TokenCounts, ToolCall, TurnAbortReason } from '../llm/index.js';
import { TurnAbortedError } from '../llm/index.js';
import { activityLine } from '../ui/activity-line.js';
import type { MarkdownStream } from '../ui/markdown-stream.type.js';
import { printToolCall } from '../ui/print-tool-call.js';
import { renderer } from '../ui/renderer.js';
import { statusActivity } from '../ui/status-activity.js';
import type { TurnContext } from './turn-context.type.js';

/** Carries the partial assistant message from whichever turn was cut out to the rollback. */
export interface AbortedTurn {
  message: Message;
}

/**
 * Stream one assistant turn and dispatch any tool calls. Returns true if tool calls were
 * dispatched (caller should run another turn), false otherwise.
 */
export async function runTurn(ctx: TurnContext, start: () => StreamHandle, cut: AbortedTurn): Promise<boolean> {
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
