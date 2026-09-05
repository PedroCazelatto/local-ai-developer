// One extra audit row a tool declares for an internal sub-step. Folder vocabulary: the tool that has
// a sub-step builds one, the dispatcher writes it, and neither owns the shape.

import type { ToolCallDisplay } from '../core/ui/types.js';
import type { JsonObject } from './json-object.type.js';

/** One extra audit row a tool declares for an internal sub-step (e.g. a build before a run). */
export interface ToolAuditExtra {
  readonly tool: string;
  readonly args: Record<string, unknown>;
  readonly exitStatus: number;
  readonly durationMs: number;
  readonly output: string;
  readonly error: string | null;
  readonly metadata?: JsonObject;
  /** The sub-step's own `←` line — a build that failed is otherwise invisible from the outside. */
  readonly display?: ToolCallDisplay;
}
