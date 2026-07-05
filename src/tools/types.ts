// Tool types (V1/02). One vocabulary for every model-callable action: the module shape the
// registry discovers, the context a tool runs against, and the result/error contract the
// dispatcher understands. Every phase gets every tool (no per-phase gating — the phase markdown
// steers usage, code does not); the dispatcher is the single choke point where calls are
// validated, executed, audited (V1/06), and turned into a `tool` message the model reads.

import type { SandboxClient } from '../core/container/index.js';

// ------------------------------------------------------------------ JSON + JSON-schema vocabulary

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export interface JsonObject {
  [key: string]: JsonValue;
}

/** One property in a tool's parameter schema (JSON-schema subset Ollama accepts). */
export interface JSONSchemaProperty {
  readonly type: string; // "string" | "number" | "integer" | "boolean" | "object" | "array"
  readonly description?: string;
  readonly default?: JsonValue;
}

/** A tool's `parameters`: always a JSON-schema object with named properties + a required list. */
export interface JSONSchema {
  readonly type: 'object';
  readonly properties: Record<string, JSONSchemaProperty>;
  readonly required?: readonly string[];
}

// ---------------------------------------------------------------------------- result / error shape

/**
 * A structured tool result. `content` is what the model sees as the `tool` message — a string is
 * used verbatim, an object is JSON-stringified (V1/02). `exitStatus` / `error` feed the audit row
 * (V1/06): file tools omit them (0 / null derived), while execute_command / run_in_project set the
 * REAL shell/container exit code so the audit records it, not a flattened 0.
 */
export interface StructuredToolResult {
  readonly content: string | JsonObject;
  readonly exitStatus?: number;
  readonly error?: string | null;
  /** Tool-specific fields recorded on the audit row (e.g. execute_command's resolved workdir). */
  readonly metadata?: JsonObject;
  /**
   * Extra audit rows for internal sub-steps of one tool call — e.g. run_in_project's auto-build,
   * which is logged as its own row BEFORE the run row (V1/05/06). The dispatcher writes these; the
   * tool never touches the audit log directly.
   */
  readonly auditExtras?: readonly ToolAuditExtra[];
}

/** One extra audit row a tool declares for an internal sub-step (e.g. a build before a run). */
export interface ToolAuditExtra {
  readonly tool: string;
  readonly args: Record<string, unknown>;
  readonly exitStatus: number;
  readonly durationMs: number;
  readonly output: string;
  readonly error: string | null;
  readonly metadata?: JsonObject;
}

/** A plain string is the simple success path; a StructuredToolResult carries JSON / audit detail. */
export type ToolResult = string | StructuredToolResult;

/**
 * The canonical structured recoverable error the model can read and retry from. Same shape for the
 * dispatcher and every tool: `{ error, hint? }` as the model-facing content, plus `exitStatus: -1`
 * and `error` for the audit row. The turn never dies on a bad call — the model gets this as tool
 * output and tries again (V1/02).
 */
export function toolError(message: string, hint?: string): StructuredToolResult {
  const content: JsonObject = hint === undefined ? { error: message } : { error: message, hint };
  return { content, exitStatus: -1, error: message };
}

// ---------------------------------------------------------------------------------- tool + context

/**
 * The active-project binding + sandbox handle every tool runs against. `resolve` scopes a path
 * under the project root and rejects any escape (V1/03); `sandbox` is the root sandbox handle for
 * shell/container tools (V1/04); `phase` is the active phase name, recorded on the audit row.
 */
export interface ToolContext {
  readonly projectName: string; // e.g. "hello-world"
  readonly projectPath: string; // host path: projects/<active> (orchestrator-side)
  readonly workspacePath: string; // "/workspace" — the mount point inside the sandbox
  readonly sandbox: SandboxClient; // Foundation/04 dockerode handle (root sandbox)
  readonly phase: string; // active phase name, for the audit row
  /** Join `relative` onto the project root, rejecting any path that escapes it (throws on escape). */
  resolve(relative: string): string;
}

/** One model-callable action. Dropped into src/tools/ and picked up by the registry (V1/02). */
export interface ToolModule {
  /** Unique, snake_case, e.g. "read_file". */
  readonly name: string;
  /** Sent to the model in the tools array. */
  readonly description: string;
  /** JSON-schema object describing the arguments. */
  readonly parameters: JSONSchema;
  /** Run the tool; return a result or a structured recoverable error (never throw for a bad call). */
  execute(ctx: ToolContext, args: Record<string, unknown>): Promise<ToolResult>;
}
