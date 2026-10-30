// The one way a tool says "that call was wrong, try again" — the canonical structured recoverable
// error, shared by the dispatcher and all 25 tools so a bad call always reads the same way. It was the
// lone function in the retired tools/types.ts; the nine types that sat around it are now nine
// one-type modules beside this file.

import type { JsonObject } from './json-object.type.js';
import type { StructuredToolResult } from './structured-tool-result.type.js';

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
