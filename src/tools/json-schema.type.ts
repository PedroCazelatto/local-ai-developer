// A tool's whole parameter schema. Folder vocabulary: declared by every ToolModule, read by the
// registry when it builds Ollama's `tools` array and by the dispatcher when it checks a call's args.

import type { JSONSchemaProperty } from './json-schema-property.type.js';

/** A tool's `parameters`: always a JSON-schema object with named properties + a required list. */
export interface JSONSchema {
  readonly type: 'object';
  readonly properties: Record<string, JSONSchemaProperty>;
  readonly required?: readonly string[];
}
