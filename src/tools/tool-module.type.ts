// One model-callable action. Folder vocabulary: 25 files declare one, registry.ts indexes them and
// resolve-phase-tools.ts narrows the set per phase — the shape belongs to the directory.

import type { JSONSchema } from './json-schema.type.js';
import type { ToolContext } from './tool-context.type.js';
import type { ToolResult } from './tool-result.type.js';

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
