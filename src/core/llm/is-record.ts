// The narrowing every "did the model hand us a JSON object?" check needs: a plain object, so neither
// null (which `typeof` calls an object) nor an array (which `in` would answer for by index).

/** Whether `value` is a non-null, non-array object — safe to probe with the `in` operator. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
