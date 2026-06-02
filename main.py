import os
import sys
from collections.abc import Callable, Generator

from dotenv import load_dotenv

from core.llm.stream_filter import StreamFilter
from core.session.orchestrator import SessionOrchestrator
from interface.terminal_loop import TerminalLoop
from tools.factories import CommandFactory

load_dotenv()

MODEL_NAME = "qwen2.5-coder:14b"
DEFAULT_NUM_CTX = 16384
MAX_TOOL_ROUNDS = 8


def _run_turn(
    orchestrator: SessionOrchestrator,
    ui: TerminalLoop,
    persona: str,
    stream: Callable[[], Generator[str, None, None]],
) -> bool:
    """Stream one assistant turn and dispatch any tool calls.
    Returns True if tools were dispatched (caller should run another turn).
    """
    ui.begin_stream()
    filt = StreamFilter()
    for delta in stream():
        visible = filt.push(delta)
        if visible:
            ui.append_stream_delta(visible)
    tail = filt.flush()
    if tail:
        ui.append_stream_delta(tail)

    msg = orchestrator.last_stream_message
    cleaned = msg.get("content", "") or ""
    ui.update_tokens(orchestrator.last_token_count)

    if cleaned.strip():
        ui.finalize_stream_as_assistant(persona)
    else:
        ui.cancel_stream()

    if not msg.get("tool_calls"):
        orchestrator.memory.add("assistant", cleaned)
        return False

    # qwen2.5-coder's chat template renders assistant `content` OR `tool_calls`
    # (if/else), so drop the prose to ensure the tool-call rendering survives.
    orchestrator.memory.add("assistant", "", tool_calls=msg["tool_calls"])
    for call in msg["tool_calls"]:
        name = call["function"]["name"]
        args = call["function"]["arguments"]
        ui.add_system_message(f"→ tool: {name}")
        tool_output = orchestrator.call_tool(name, args)
        orchestrator.memory.add("tool", tool_output, name=name)
    return True


def _process_message(orchestrator: SessionOrchestrator, ui: TerminalLoop, prompt: str) -> None:
    persona = orchestrator.agent.role

    if not _run_turn(orchestrator, ui, persona, lambda: orchestrator.stream_ask(prompt)):
        return

    for _ in range(MAX_TOOL_ROUNDS):
        if not _run_turn(orchestrator, ui, persona, orchestrator.stream_continue):
            return

    ui.add_system_message(f"⚠ Reached tool-call limit ({MAX_TOOL_ROUNDS}). Stopping.")


def _process_command(
    commands: CommandFactory,
    orchestrator: SessionOrchestrator,
    ui: TerminalLoop,
    raw: str,
) -> None:
    stripped = raw.strip()
    cmd_name = stripped.lstrip("/").split(maxsplit=1)[0] if stripped.lstrip("/") else ""
    result = commands.dispatch(stripped, orchestrator)
    if cmd_name == "clear":
        ui.clear_messages()
    if result.message:
        ui.add_system_message(result.message)
    ui.set_persona(orchestrator.agent.role)
    if result.exit:
        ui.request_exit()


def _make_handler(
    orchestrator: SessionOrchestrator,
    commands: CommandFactory,
    ui: TerminalLoop,
):
    def handler(batch: list[str]) -> None:
        if not batch:
            return
        first = batch[0].strip()
        if first.startswith("/"):
            _process_command(commands, orchestrator, ui, batch[0])
            return
        combined = "\n\n".join(item.strip() for item in batch if item.strip())
        if not combined:
            return
        _process_message(orchestrator, ui, combined)

    return handler


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python main.py <project_name>")
        return

    project_name = sys.argv[1]
    num_ctx = int(os.getenv("OLLAMA_NUM_CTX", str(DEFAULT_NUM_CTX)))
    orchestrator = SessionOrchestrator(project_name, MODEL_NAME, num_ctx=num_ctx)
    commands = CommandFactory()

    ui = TerminalLoop(
        persona=orchestrator.agent.role,
        project=project_name,
        model=MODEL_NAME,
        num_ctx=num_ctx,
    )
    ui.add_system_message("Local AI Developer  ·  /swap <role>  ·  /clear  ·  /exit")
    ui.run(_make_handler(orchestrator, commands, ui))


if __name__ == "__main__":
    main()
