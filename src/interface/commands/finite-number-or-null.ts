// One numeric field of a parsed JSONL row, or null when it was not usable. Split out of
// read-audit-rows.ts, where it was private and called `readNumber`.
//
// The `-or-null` half of the name is the point, the way sql-int-or-null.ts's is: null here means "the
// row reported nothing", which the /audit listing prints as `unknown` rather than as a 0 that would
// read as a real measurement (constitution: token counts and metrics are exact or absent, never
// guessed). A caller that defaulted it to 0 would be inventing a value, so the name refuses to let
// that happen quietly.

/** A row field that must be a finite number, else null — surfaced as unknown, never defaulted to 0. */
export function finiteNumberOrNull(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}
