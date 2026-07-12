// Types for the Ollama model-management wrappers (V5/02) — sibling of ollama-models.ts (constitution:
// types live beside the function they serve). These describe the daemon-management surface (`list` /
// `pull`), distinct from OllamaClient's per-turn chat surface.

import type { ProgressResponse } from 'ollama';

/** One locally-installed model, projected from Ollama's ModelResponse to just what `/models list` shows. */
export interface InstalledModel {
  /** Full tagged name, e.g. `qwen2.5-coder:3b` — what `/models use` must match exactly. */
  readonly name: string;
  /** On-disk size in bytes (formatted human-readable for the table). */
  readonly size: number;
  /** When the blob was last written locally. */
  readonly modifiedAt: Date;
}

/** A single streamed pull progress event (Ollama emits `status` + `completed`/`total` bytes per chunk). */
export type PullProgress = ProgressResponse;

/** Called for every streamed pull progress event so the UI can render a live line. */
export type PullProgressHandler = (progress: PullProgress) => void;

/** The result of a pull: `cancelled` true when a Ctrl-C aborted it mid-stream (not an error). */
export interface PullOutcome {
  readonly cancelled: boolean;
}
