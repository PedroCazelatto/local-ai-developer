// Normalize the model's arguments to a plain object.
//
// Ollama usually hands over an object, but some model/client versions emit a JSON STRING instead, so
// both are accepted (V1/02). THROWS on unparseable or non-object JSON rather than defaulting to {} --
// the caller turns that into a structured, recoverable error naming the tool, and a silent {} would
// instead run the tool with no arguments and report whatever that did.
//
// Named normalizeToolArgs rather than the module-private `normalizeArgs` it was extracted from.

/**
 * Normalize the model's arguments to a plain object. Ollama usually hands over an object, but some
 * model/client versions emit a JSON string — accept both (V1/02). Throws on unparseable/non-object
 * JSON so the caller can turn it into a structured error.
 */
export function normalizeToolArgs(raw: unknown): Record<string, unknown> {
  if (raw === undefined || raw === null) return {};
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '') return {};
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('arguments must be a JSON object');
    }
    return parsed as Record<string, unknown>;
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  throw new Error('arguments must be an object or a JSON object string');
}
