// One field of a parsed JSONL row, taken only if it is a non-empty string. Split out of
// read-audit-rows.ts, where it was private and called `readText` — a name that, as a file, would read
// as "read some text off disk", which is the one thing it does not do. It narrows a value that has
// already been parsed.

/** A row field that must be a non-empty string, or undefined when it is anything else. */
export function nonEmptyText(raw: unknown): string | undefined {
  return typeof raw === 'string' && raw !== '' ? raw : undefined;
}
