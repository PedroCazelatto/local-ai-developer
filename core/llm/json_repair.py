"""Tolerant decoding for the classic local-model JSON fault: literal control
characters (newlines, tabs, carriage returns) inside string values. qwen2.5-coder
writes multi-line `write_file` content with real newlines instead of \\n, which
`json.loads` rejects. Same shim family as `tool_call_recovery`.
"""
import json

_CONTROL_ESCAPES = {"\n": "\\n", "\r": "\\r", "\t": "\\t"}


def repair_decode(text: str) -> tuple[object, int] | None:
    """Decode a JSON object starting at ``text[0] == '{'``, escaping literal
    control characters found inside strings. Returns ``(obj, consumed_chars)``
    where `consumed_chars` counts characters of the original text, or ``None``
    if no parseable object is found.
    """
    if not text.startswith("{"):
        return None
    repaired: list[str] = []
    depth = 0
    in_string = False
    escape = False
    for i, ch in enumerate(text):
        if escape:
            escape = False
            repaired.append(ch)
            continue
        if in_string:
            if ch == "\\":
                escape = True
                repaired.append(ch)
            elif ch == '"':
                in_string = False
                repaired.append(ch)
            else:
                repaired.append(_CONTROL_ESCAPES.get(ch, ch))
            continue
        repaired.append(ch)
        if ch == '"':
            in_string = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads("".join(repaired)), i + 1
                except json.JSONDecodeError:
                    return None
    return None


def loads_or_repair(text: str) -> object | None:
    """`json.loads` with the repair pass as fallback. Returns the parsed value
    or ``None``. The repaired parse must consume the whole text (modulo
    trailing whitespace) to count.
    """
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    decoded = repair_decode(text.strip())
    if decoded is None:
        return None
    obj, consumed = decoded
    if text.strip()[consumed:].strip():
        return None
    return obj
