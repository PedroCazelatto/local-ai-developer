"""Recover tool calls qwen2.5-coder emits as bare JSON in the streamed content
instead of inside <tool_call> tags. Ollama 0.20.x doesn't lift those into the
structured `tool_calls` field for this model, so the orchestrator never sees
them. Delete this shim once Ollama parses them reliably.
"""
import json
import re
from typing import Any

from core.llm.json_repair import repair_decode

_TAGGED = re.compile(r"<tool_call>\s*(\{.*?\})\s*</tool_call>", re.DOTALL)
# A markdown fence opener (``` + optional language) sitting at the end of the
# text that precedes a recovered call — used to swallow the fence with the call.
_FENCE_BEFORE = re.compile(r"```[A-Za-z0-9_+.-]*[ \t]*(?:\r?\n[ \t]*)?\Z")


def recover_tool_calls(content: str) -> tuple[str, list[dict[str, Any]]]:
    """Return (cleaned_content, tool_calls). `tool_calls` is empty if none were
    recovered. Each recovered call matches the Ollama shape:
    `{"function": {"name": str, "arguments": dict}}`.
    """
    calls: list[dict[str, Any]] = []
    spans: list[tuple[int, int]] = []

    for match in _TAGGED.finditer(content):
        call = _parse_call(match.group(1))
        if call is not None:
            calls.append(call)
            spans.append(_expand_over_fence(content, match.start(), match.end()))
    if calls:
        return _strip_spans(content, spans).strip(), calls

    decoder = json.JSONDecoder()
    i = 0
    while i < len(content):
        if content[i] != "{":
            i += 1
            continue
        try:
            obj, end = decoder.raw_decode(content[i:])
        except json.JSONDecodeError:
            repaired = repair_decode(content[i:])
            if repaired is None:
                i += 1
                continue
            obj, end = repaired
        call = _coerce_call(obj)
        if call is not None:
            calls.append(call)
            spans.append(_expand_over_fence(content, i, i + end))
        i += end

    if calls:
        return _strip_spans(content, spans).strip(), calls
    return content, []


def _parse_call(payload: str) -> dict[str, Any] | None:
    try:
        obj: object = json.loads(payload)
    except json.JSONDecodeError:
        repaired = repair_decode(payload.strip())
        if repaired is None:
            return None
        obj = repaired[0]
    return _coerce_call(obj)


def _expand_over_fence(content: str, start: int, end: int) -> tuple[int, int]:
    """If the span is wrapped in a markdown fence (```json ... ```), widen it to
    swallow the fence too, so stripping leaves no empty-fence debris."""
    opener = _FENCE_BEFORE.search(content, 0, start)
    if opener is None or opener.end() != start:
        return start, end
    j = end
    while j < len(content) and content[j] in " \t\r\n":
        j += 1
    if content.startswith("```", j):
        return opener.start(), j + 3
    if j >= len(content):  # fence never closed (stream ended) — eat the opener anyway
        return opener.start(), j
    return start, end


def _coerce_call(obj: object) -> dict[str, Any] | None:
    if not isinstance(obj, dict):
        return None
    name = obj.get("name") or obj.get("function_name") or obj.get("tool")
    args = obj.get("arguments")
    if args is None:
        args = obj.get("parameters", {})
    if isinstance(args, str):
        try:
            args = json.loads(args) if args.strip() else {}
        except json.JSONDecodeError:
            return None
    if not isinstance(name, str) or not isinstance(args, dict):
        return None
    return {"function": {"name": name, "arguments": args}}


def _strip_spans(text: str, spans: list[tuple[int, int]]) -> str:
    """Remove sorted (start, end) substrings from `text`, tolerating overlap."""
    parts: list[str] = []
    cursor = 0
    for start, end in spans:
        parts.append(text[cursor:max(start, cursor)])
        cursor = max(cursor, end)
    parts.append(text[cursor:])
    return "".join(parts)
