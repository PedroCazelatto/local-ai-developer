// `/models list` (V5/02) — a thin, session-agnostic query against the HOST Ollama daemon.

import { daemon } from './daemon.js';

/** One locally-installed model, projected from Ollama's ModelResponse to just what `/models list` shows. */
export interface InstalledModel {
  /** Full tagged name, e.g. `qwen2.5-coder:3b` — what `/models use` must match exactly. */
  readonly name: string;
  /** On-disk size in bytes (formatted human-readable for the table). */
  readonly size: number;
  /** When the blob was last written locally. */
  readonly modifiedAt: Date;
}

/** List locally-installed models, projected to { name, size, modifiedAt } and sorted by name. */
export async function listModels(): Promise<InstalledModel[]> {
  const { models } = await daemon.list();
  return models
    .map((m) => ({ name: m.name, size: m.size, modifiedAt: m.modified_at }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
