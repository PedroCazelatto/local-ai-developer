// One property in a tool's parameter schema. Folder vocabulary: every tool declares one of these per
// argument, and the registry reads them back to build Ollama's `tools` array.

import type { JsonValue } from './json-value.type.js';

/**
 * One property in a tool's parameter schema (JSON-schema subset Ollama accepts). Recursive via
 * `items`/`properties` so a tool can declare structured arguments — ask_user's list of questions,
 * each with its own list of options. Ollama's own Tool type declares those slots untyped, so the
 * nesting is described HERE and passed through verbatim (toolDefinitions).
 */
export interface JSONSchemaProperty {
  readonly type: string; // "string" | "number" | "integer" | "boolean" | "object" | "array"
  readonly description?: string;
  readonly default?: JsonValue;
  /** Element schema, for `type: 'array'`. */
  readonly items?: JSONSchemaProperty;
  /** Member schemas, for `type: 'object'`. */
  readonly properties?: Record<string, JSONSchemaProperty>;
  /** Which members are mandatory, for `type: 'object'`. */
  readonly required?: readonly string[];
}
