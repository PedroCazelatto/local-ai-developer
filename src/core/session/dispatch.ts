// Tool dispatch (V1/02) — the single choke point every tool call passes through: normalize the
// model's arguments, look the tool up, validate required params, execute it, and turn the outcome
// into the `tool` message string the model reads back. NOTHING here throws up into the turn loop:
// an unknown tool, malformed args, a missing required field, or a tool that throws all become a
// structured recoverable error `{ error, hint? }` so the model can self-correct and the turn
// continues. This is also where the audit log hooks in (V1/06) via the `onToolCall` seam.

import { getTool, toolNames } from '../../tools/registry.js';
import type { JSONSchema, JsonObject, ToolContext, ToolResult } from '../../tools/types.js';
import { toolError } from '../../tools/types.js';

/** Raw materials for one audit row, handed to the audit sink (V1/06 formats + writes the JSONL). */
export interface ToolCallRecord {
  readonly ts: string; // UTC ISO-8601 ms, captured when the call started (new Date().toISOString())
  readonly phase: string; // active phase at dispatch time
  readonly tool: string; // tool name as dispatched
  readonly args: Record<string, unknown>; // normalized, parsed arguments
  readonly exitStatus: number; // 0 success, real code for shell/container tools, -1 for any failure
  readonly durationMs: number; // wall-clock around execute()
  readonly output: string; // full tool result (the sink truncates to a preview)
  readonly error: string | null; // null on success; the error message on failure
  readonly metadata?: JsonObject; // tool-specific fields (e.g. execute_command's workdir)
}

export interface DispatchDeps {
  /** Audit sink — called once per dispatched call (success or failure). Wired by V1/06. */
  readonly onToolCall?: (record: ToolCallRecord) => void;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Normalize the model's arguments to a plain object. Ollama usually hands over an object, but some
 * model/client versions emit a JSON string — accept both (V1/02). Throws on unparseable/non-object
 * JSON so the caller can turn it into a structured error.
 */
function normalizeArgs(raw: unknown): Record<string, unknown> {
  if (raw === undefined || raw === null) return {};
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '') return {};
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('arguments must be a JSON object');
    }
    return parsed as Record<string, unknown>;
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  throw new Error('arguments must be an object or a JSON object string');
}

/** First required parameter that is absent, or null if all are present. */
function firstMissingRequired(schema: JSONSchema, args: Record<string, unknown>): string | null {
  for (const field of schema.required ?? []) {
    if (args[field] === undefined) return field;
  }
  return null;
}

interface SerializedResult {
  readonly content: string;
  readonly exitStatus: number;
  readonly error: string | null;
  readonly metadata?: JsonObject;
}

/** Collapse a ToolResult into the model-facing string + the audit exit_status/error/metadata. */
function serializeResult(result: ToolResult): SerializedResult {
  if (typeof result === 'string') {
    return { content: result, exitStatus: 0, error: null };
  }
  const content = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
  const errorField = errorOf(result.content);
  const exitStatus = result.exitStatus ?? (errorField !== null ? -1 : 0);
  const error = result.error !== undefined ? result.error : errorField;
  return { content, exitStatus, error, metadata: result.metadata };
}

/** The `error` string of a structured payload, if it carries one (for deriving exit_status/error). */
function errorOf(content: string | JsonObject): string | null {
  if (typeof content === 'object' && content !== null) {
    const value = content['error'];
    if (typeof value === 'string') return value;
  }
  return null;
}

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
    });
    return output;
  };

  // 1) Normalize arguments (string or object). Unparseable → recoverable error.
  let args: Record<string, unknown>;
  try {
    args = normalizeArgs(rawArgs);
  } catch (err) {
    const s = serializeResult(toolError(`invalid arguments for '${name}': ${messageOf(err)}`));
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
    const s = serializeResult(toolError(`missing required parameter '${missing}' for tool '${name}'`));
    return record(args, s.exitStatus, s.content, s.error, 0);
  }

  // 4) Execute. Any throw becomes a structured error — still recoverable, still audited.
  const start = performance.now();
  try {
    const result = await tool.execute(ctx, args);
    const s = serializeResult(result);
    return record(args, s.exitStatus, s.content, s.error, Math.round(performance.now() - start), s.metadata);
  } catch (err) {
    const s = serializeResult(toolError(messageOf(err)));
    return record(args, s.exitStatus, s.content, s.error, Math.round(performance.now() - start));
  }
}
