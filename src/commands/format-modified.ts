// The last-modified column of the `/models list` table (V5/02).

/** Local `YYYY-MM-DD HH:mm` for the last-modified column. Coerces (the daemon may hand back a string). */
export function formatModified(value: Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  const p2 = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p2(date.getMonth() + 1)}-${p2(date.getDate())} ${p2(date.getHours())}:${p2(date.getMinutes())}`;
}
