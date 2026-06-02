"""Recover tool calls qwen2.5-coder emits as bare JSON in the streamed content
instead of inside <tool_call> tags. Ollama 0.20.x doesn't lift those into the
structured `tool_calls` field for this model, so the orchestrator never sees
them. Delete this shim once Ollama parses them reliably.
"""
import json
import re
from typing import Any

_TAGGED = re.compile(r"<tool_call>\s*(\{.*?\})\s*</tool_call>", re.DOTALL)


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
            spans.append((match.start(), match.end()))
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
            i += 1
            continue
        call = _coerce_call(obj)
        if call is not None:
            calls.append(call)
            spans.append((i, i + end))
        i += end

    if calls:
        return _strip_spans(content, spans).strip(), calls
    return content, []


def _parse_call(payload: str) -> dict[str, Any] | None:
    try:
        obj = json.loads(payload)
    except json.JSONDecodeError:
        return None
    return _coerce_call(obj)


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
    """Remove non-overlapping, sorted (start, end) substrings from `text`."""
    parts: list[str] = []
    cursor = 0
    for start, end in spans:
        parts.append(text[cursor:start])
        cursor = end
    parts.append(text[cursor:])
    return "".join(parts)
