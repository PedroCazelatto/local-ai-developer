// The time-of-day column of an /audit row. Split out of format-audit-row.ts; the private helper was
// called `clock`, which names a device rather than a job and would have sat in a flat folder beside
// format-local-stamp.ts with nothing to tell the two apart. `auditClock` says whose column it fills,
// and the header says why it prints no date.

/**
 * The row's UTC timestamp as a LOCAL `HH:mm:ss`. Time only, not the date: /audit shows a recent tail,
 * so the date is the same on nearly every row and would cost width the tool name needs. A value that
 * will not parse holds its column with `--:--:--` rather than collapsing the table.
 */
export function auditClock(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '--:--:--';
  const when = new Date(ms);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(when.getHours())}:${pad(when.getMinutes())}:${pad(when.getSeconds())}`;
}
