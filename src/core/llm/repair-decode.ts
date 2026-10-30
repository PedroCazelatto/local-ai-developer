// Tolerant JSON decoding for the classic local-model fault: literal control characters
// (newlines / tabs / carriage returns) inside string values. qwen2.5-coder writes multi-line
// content with real newlines instead of \n, which JSON.parse rejects. Port of
// core/llm/json_repair.py; reused by loads-or-repair.ts and by tool-call recovery.

const CONTROL_ESCAPES: Readonly<Record<string, string>> = {
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
};

/**
 * Decode a JSON object starting at `text[0] === '{'`, escaping literal control characters
 * found inside strings. Returns `{ value, consumed }` where `consumed` counts characters of
 * the original text, or `null` if no parseable object is found. Exposed for tool-call recovery,
 * which needs a raw-decode (parse one object, ignore trailing text) rather than a whole-string parse.
 */
export function repairDecode(text: string): { value: unknown; consumed: number } | null {
  if (!text.startsWith('{')) return null;
  const repaired: string[] = [];
  let depth = 0;
  let inString = false;
  let escape = false;
  let i = -1;
  for (const ch of text) {
    i += 1;
    if (escape) {
      escape = false;
      repaired.push(ch);
      continue;
    }
    if (inString) {
      if (ch === '\\') {
        escape = true;
        repaired.push(ch);
      } else if (ch === '"') {
        inString = false;
        repaired.push(ch);
      } else {
        repaired.push(CONTROL_ESCAPES[ch] ?? ch);
      }
      continue;
    }
    repaired.push(ch);
    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return { value: JSON.parse(repaired.join('')), consumed: i + 1 };
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
