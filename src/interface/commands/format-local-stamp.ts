// A stored UTC ISO timestamp as a LOCAL `YYYY-MM-DD HH:mm` — what /blockers and /inbox date their
// rows with. The stores all stamp UTC (so the files sort and compare correctly wherever they are
// read), but a user reading their own scrollback wants the clock on their own wall.
//
// An unparseable value says so rather than printing an Invalid Date or quietly falling back to now:
// a wrong timestamp in a blocker listing is worse than an absent one, because it looks right.

/** `2026-08-10 10:03` in local time, or `unknown time` when the stored value will not parse. */
export function formatLocalStamp(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return 'unknown time';
  const when = new Date(ms);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())} ${pad(when.getHours())}:${pad(when.getMinutes())}`;
}
