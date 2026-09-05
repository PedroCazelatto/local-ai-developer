// The OLLAMA_TIMEOUT_MS env resolver — one of the four functions config.ts used to hold.

import { DEFAULT_TIMEOUT_MS } from './config.js';

/**
 * Read OLLAMA_TIMEOUT_MS, guarding NaN / non-positive values by falling back loudly. A zero or negative
 * window would fire the watchdog before the model could answer at all — it reads as "no timeout" but
 * behaves as "cancel everything" — so it is rejected rather than honoured.
 */
export function resolveTimeoutMs(): number {
  const raw = process.env.OLLAMA_TIMEOUT_MS;
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_TIMEOUT_MS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(
      `Warning: OLLAMA_TIMEOUT_MS='${raw}' is not a positive number of milliseconds; ` +
        `using default ${DEFAULT_TIMEOUT_MS}.`,
    );
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.floor(parsed);
}
