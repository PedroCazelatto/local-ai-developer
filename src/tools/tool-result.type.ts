// What a tool hands back. Folder vocabulary — the union every ToolModule.execute returns and the
// dispatcher narrows. Types importing types is expected: the union names its structured member.

import type { StructuredToolResult } from './structured-tool-result.type.js';

/** A plain string is the simple success path; a StructuredToolResult carries JSON / audit detail. */
export type ToolResult = string | StructuredToolResult;
