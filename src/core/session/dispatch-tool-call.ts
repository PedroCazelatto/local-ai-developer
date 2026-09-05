// Tool dispatch (V1/02) — the single choke point every tool call passes through: normalize the
// model's arguments, look the tool up, validate required params, execute it, and turn the outcome
// into the `tool` message string the model reads back. Tool FAILURES never throw up into the turn loop:
// an unknown tool, malformed args, a missing required field, or a tool that throws all become a
// structured recoverable error `{ error, hint? }` so the model can self-correct and the turn
// continues. This is also where the audit log hooks in (V1/06) via the `onToolCall` seam.
//
// EXACTLY ONE exception, and it is not a tool failure: a TurnAbortedError raised inside a tool that was
// itself running a model call — a sub-agent's turn, search_rules' throwaway one-shot, a debate round.
// The user cancelled the whole turn; handing that back as a tool result would let the parent read "the
// call failed", reason about it, and carry on, which is the exact opposite of what the key press meant.
// It is audited first (the call did happen) and then rethrown.
//
// `record` below is an arrow LOCAL to this function, closing over the audit sink and the call's start
// timestamp so every one of the five exit paths writes exactly one row the same way. A local is not a
// declaration (constitution), and lifting it out would mean threading four values through every call.

import { getTool } from '../../tools/get-tool.js';
import type { JsonObject } from '../../tools/json-object.type.js';
import type { ToolContext } from '../../tools/tool-context.type.js';
import { toolError } from '../../tools/tool-error.js';
import { toolNames } from '../../tools/tool-names.js';
import { errMessage } from '../err-message.js';
import { TurnAbortedError } from '../llm/index.js';
import type { ToolCallDisplay } from '../ui/tool-call-display.type.js';
import type { DispatchDeps } from './dispatch-deps.type.js';
import { firstMissingRequired } from './first-missing-required.js';
import { normalizeToolArgs } from './normalize-tool-args.js';
import { serializeToolResult } from './serialize-tool-result.js';

/**
 * Dispatch one tool call and return the string to feed back to the model as the `tool` message
 * content. Records exactly one audit row per call (success or failure) through `deps.onToolCall`.
 */
export async function dispatchToolCall(
  ctx: ToolContext,
  name: string,
  rawArgs: unknown,
  deps: DispatchDeps = {},
): Promise<string> {
  const ts = new Date().toISOString();

  const record = (
    args: Record<string, unknown>,
    exitStatus: number,
    output: string,
    error: string | null,
    durationMs: number,
    metadata?: JsonObject,
    display?: ToolCallDisplay,
  ): string => {
    deps.onToolCall?.({
      ts,
      phase: ctx.phase,
      tool: name,
      args,
      exitStatus,
      durationMs,
      output,
      error,
      ...(metadata !== undefined ? { metadata } : {}),
      ...(display !== undefined ? { display } : {}),
    });
    return output;
  };

  // 1) Normalize arguments (string or object). Unparseable → recoverable error.
  let args: Record<string, unknown>;
  try {
    args = normalizeToolArgs(rawArgs);
  } catch (err) {
    const s = serializeToolResult(toolError(`invalid arguments for '${name}': ${errMessage(err)}`));
    return record({}, s.exitStatus, s.content, s.error, 0);
  }

  // 2) Unknown tool → recoverable error listing what IS available.
  const tool = getTool(name);
  if (tool === undefined) {
    const content: JsonObject = { error: `unknown tool '${name}'`, available: toolNames() };
    const output = JSON.stringify(content);
    return record(args, -1, output, `unknown tool '${name}'`, 0);
  }

  // 3) Missing required parameter → recoverable error naming the field. (Type-correctness of a
  //    present field is left to the tool, which owns its verbatim error strings — V1/03.)
  const missing = firstMissingRequired(tool.parameters, args);
  if (missing !== null) {
    const s = serializeToolResult(toolError(`missing required parameter '${missing}' for tool '${name}'`));
    return record(args, s.exitStatus, s.content, s.error, 0);
  }

  // 4) Execute. Any throw becomes a structured error — still recoverable, still audited.
  const start = performance.now();
  try {
    const result = await tool.execute(ctx, args);
    const s = serializeToolResult(result);
    // Extra sub-step rows (e.g. run_in_project's build) are written FIRST so they precede the run —
    // and so their `←` line prints above the run's, in the order the two steps actually happened.
    for (const extra of s.auditExtras ?? []) {
      deps.onToolCall?.({
        ts,
        phase: ctx.phase,
        tool: extra.tool,
        args: extra.args,
        exitStatus: extra.exitStatus,
        durationMs: extra.durationMs,
        output: extra.output,
        error: extra.error,
        ...(extra.metadata !== undefined ? { metadata: extra.metadata } : {}),
        ...(extra.display !== undefined ? { display: extra.display } : {}),
      });
    }
    return record(
      args,
      s.exitStatus,
      s.content,
      s.error,
      Math.round(performance.now() - start),
      s.metadata,
      s.display,
    );
  } catch (err) {
    const s = serializeToolResult(toolError(errMessage(err)));
    // Audited either way — a cancelled call still happened, and the audit log is the only durable record
    // of it — then the one exception in this file is rethrown rather than returned. See the header.
    const output = record(args, s.exitStatus, s.content, s.error, Math.round(performance.now() - start));
    if (err instanceof TurnAbortedError) throw err;
    return output;
  }
}
