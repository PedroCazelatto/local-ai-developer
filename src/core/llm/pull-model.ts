// `/models pull` (V5/02) — a thin, session-agnostic streamed pull against the HOST Ollama daemon.

import type { ProgressResponse } from 'ollama';

import { daemon } from './daemon.js';

/** A single streamed pull progress event (Ollama emits `status` + `completed`/`total` bytes per chunk). */
export type PullProgress = ProgressResponse;

/** Called for every streamed pull progress event so the UI can render a live line. */
export type PullProgressHandler = (progress: PullProgress) => void;

/** The result of a pull: `cancelled` true when a Ctrl-C aborted it mid-stream (not an error). */
export interface PullOutcome {
  readonly cancelled: boolean;
}

/**
 * Pull `name` from the registry, STREAMING progress to `onProgress` and BLOCKING until the pull finishes
 * (the caller must not let `/models use` proceed before this resolves). `signal` (from the REPL's Ctrl-C
 * handler) aborts the in-flight request cleanly: on abort we tear down only THIS streamed request via the
 * iterator's own abort() and return `{ cancelled: true }` — no throw, no half-state in the session (a
 * partial blob is Ollama's to garbage-collect). Any real network/registry error still throws for the
 * caller to surface as a recoverable message.
 */
export async function pullModel(
  name: string,
  onProgress: PullProgressHandler,
  signal: AbortSignal,
): Promise<PullOutcome> {
  // stream:true yields an AbortableAsyncIterator whose abort() cancels the underlying fetch. The `ollama`
  // package exposes no per-request signal param, so we bridge the caller's AbortSignal onto it ourselves.
  const iterator = await daemon.pull({ model: name, stream: true });
  if (signal.aborted) {
    iterator.abort();
    return { cancelled: true };
  }
  const onAbort = (): void => iterator.abort();
  signal.addEventListener('abort', onAbort, { once: true });
  try {
    for await (const progress of iterator) {
      onProgress(progress);
    }
    return { cancelled: false };
  } catch (err) {
    // An abort surfaces here as a rejected iteration; signal.aborted disambiguates it from a real error.
    if (signal.aborted) return { cancelled: true };
    throw err;
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}
