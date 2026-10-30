// The live status line pull-with-spinner.ts puts on its ora frame while a model downloads.
//
// Some events in Ollama's stream carry no byte totals at all (`verifying sha256`, `writing manifest`),
// so the percentage half is conditional: a line that read `0% (0 B/0 B)` for those would be a
// fabricated number, and this project reports what it was told or nothing.

import type { PullProgress } from '../llm/pull-model.js';
import { formatSize } from './format-size.js';

/** Live status line for a streamed pull event (some events carry no byte totals — show just the status). */
export function pullProgressText(name: string, p: PullProgress): string {
  const status = p.status ?? '';
  if (p.total > 0 && p.completed >= 0) {
    const pct = Math.floor((p.completed / p.total) * 100);
    return `pulling ${name} · ${status} · ${pct}% (${formatSize(p.completed)}/${formatSize(p.total)})`;
  }
  return `pulling ${name} · ${status}`;
}
