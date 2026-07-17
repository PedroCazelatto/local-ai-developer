// Bytes → human size. Shared by the `/models list` table and the live pull progress line (both render
// blob sizes), so it lives here rather than inside either caller.

/** `2.7 GB`, `340 MB`, `0 B` for a non-positive/NaN input. noUncheckedIndexedAccess-safe unit lookup. */
export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const shown = unit === 0 ? String(Math.round(value)) : value.toFixed(1);
  return `${shown} ${units[unit] ?? 'B'}`;
}
