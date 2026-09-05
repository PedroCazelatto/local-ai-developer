// The context-pressure ratio env resolver — one of the four functions config.ts used to hold. It takes
// its fallback as an argument, so it needs none of config.ts's DEFAULT_* constants.

/**
 * Read a context-pressure ratio from `name`, guarding NaN / a value outside (0, 1] by falling back
 * loudly. A ratio ≤ 0 never leaves headroom, and a ratio > 1 would let a window blow past num_ctx before
 * the mechanism fires — both defeat the VRAM safety they exist for, so reject them and use the default.
 *
 * Shared by both ratios rather than written twice: they are the same value with different triggers, and
 * two copies of a validator are two places for the bounds to drift apart.
 */
export function resolveRatio(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1) {
    console.warn(`Warning: ${name}='${raw}' is not a number in (0, 1]; using default ${fallback}.`);
    return fallback;
  }
  return parsed;
}
