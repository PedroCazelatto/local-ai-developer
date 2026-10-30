// Any value that survives a JSON round trip. Folder vocabulary rather than one function's type: it is
// what a tool's arguments arrive as and what its content goes back as, so no single function owns it.

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
