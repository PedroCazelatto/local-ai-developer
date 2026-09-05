// The OLLAMA_TIMEOUT_MS env resolver — one of the four functions config.ts used to hold, and now one
// of the four it assembles into the `config` object.
//
// Every DEFAULT_TIMEOUT_MS read below is INSIDE the function body on purpose: config.ts imports this
// file to compose that object and this file imports config.ts back for its fallback, so a top-level
// read would run before the `config` binding is initialised and throw. See the TDZ note in config.ts.

import { config } from './config.js';

/**
 * Read OLLAMA_TIMEOUT_MS, guarding NaN / non-positive values by falling back loudly. A zero or negative
 * window would fire the watchdog before the model could answer at all — it reads as "no timeout" but
 * behaves as "cancel everything" — so it is rejected rather than honoured.
 */
export function resolveTimeoutMs(): number {
  const raw = process.env.OLLAMA_TIMEOUT_MS;
  if (raw === undefined || raw.trim() === '') {
    return config.DEFAULT_TIMEOUT_MS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(
      `Warning: OLLAMA_TIMEOUT_MS='${raw}' is not a positive number of milliseconds; ` +
        `using default ${config.DEFAULT_TIMEOUT_MS}.`,
    );
    return config.DEFAULT_TIMEOUT_MS;
  }
  return Math.floor(parsed);
}
