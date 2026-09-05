// A JSON object — the shape a tool's structured `content` and `metadata` take. Spoken by the tools,
// the dispatcher and the audit row alike, so it is folder vocabulary and not one function's type.

import type { JsonValue } from './json-value.type.js';

export interface JsonObject {
  [key: string]: JsonValue;
}
