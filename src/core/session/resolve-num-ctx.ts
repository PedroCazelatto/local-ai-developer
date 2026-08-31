// The OLLAMA_NUM_CTX env resolver — one of the four functions config.ts used to hold.

import { DEFAULT_NUM_CTX } from './config.js';

/** Read OLLAMA_NUM_CTX, guarding against NaN / non-positive values by falling back loudly. */
export function resolveNumCtx(): number {
  const raw = process.env.OLLAMA_NUM_CTX;
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_NUM_CTX;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(
      `Warning: OLLAMA_NUM_CTX='${raw}' is not a positive number; using default ${DEFAULT_NUM_CTX}.`,
    );
    return DEFAULT_NUM_CTX;
  }
  return Math.floor(parsed);
}
