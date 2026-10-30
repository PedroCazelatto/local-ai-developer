// The OLLAMA_NUM_CTX env resolver — one of the four functions config.ts used to hold, and now one of
// the four it assembles into the `config` object.
//
// Every DEFAULT_NUM_CTX read below is INSIDE the function body on purpose: config.ts imports this file
// to compose that object and this file imports config.ts back for its fallback, so a top-level read
// would run before the `config` binding is initialised and throw. See the TDZ note in config.ts.

import { config } from './config.js';

/** Read OLLAMA_NUM_CTX, guarding against NaN / non-positive values by falling back loudly. */
export function resolveNumCtx(): number {
  const raw = process.env.OLLAMA_NUM_CTX;
  if (raw === undefined || raw.trim() === '') {
    return config.DEFAULT_NUM_CTX;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(
      `Warning: OLLAMA_NUM_CTX='${raw}' is not a positive number; using default ${config.DEFAULT_NUM_CTX}.`,
    );
    return config.DEFAULT_NUM_CTX;
  }
  return Math.floor(parsed);
}
