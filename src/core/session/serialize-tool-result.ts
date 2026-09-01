// Collapse a ToolResult into the one string the model sees plus the fields the audit row needs.
//
// A bare string result is a success by definition. A structured one derives its exit status from its
// own `error` field unless it set one, so a tool that reports a failure cannot accidentally be audited
// as a success.
//
// Named serializeToolResult rather than the module-private `serializeResult` it was extracted from.

import type { JsonObject, ToolAuditExtra, ToolResult } from '../../tools/types.js';
import type { ToolCallDisplay } from '../ui/types.js';
import { toolResultError } from './tool-result-error.js';

export interface SerializedResult {
  readonly content: string;
  readonly exitStatus: number;
  readonly error: string | null;
  readonly metadata?: JsonObject;
  readonly display?: ToolCallDisplay;
  readonly auditExtras?: readonly ToolAuditExtra[];
}

/** Collapse a ToolResult into the model-facing string + the audit exit_status/error/metadata. */
export function serializeToolResult(result: ToolResult): SerializedResult {
  if (typeof result === 'string') {
    return { content: result, exitStatus: 0, error: null };
  }
  const content = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
  const errorField = toolResultError(result.content);
  const exitStatus = result.exitStatus ?? (errorField !== null ? -1 : 0);
  const error = result.error !== undefined ? result.error : errorField;
  return {
    content,
    exitStatus,
    error,
    metadata: result.metadata,
    display: result.display,
    auditExtras: result.auditExtras,
  };
}
