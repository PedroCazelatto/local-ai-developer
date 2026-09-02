// What the turn loop needs from whatever window it is running -- the session's active phase, or a
// spawned Worker / Reviewer / Retro window. The loop is written against this and nothing else, which
// is what lets one implementation drive five different kinds of window.

import type { Message, ToolCall } from 'ollama';

import type { StreamHandle } from '../llm/client.js';
import type { TokenCounts } from '../llm/token-counts.type.js';
import type { TurnAbortReason } from '../llm/turn-aborted-error.js';
import { TurnAbortedError } from '../llm/turn-aborted-error.js';

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
