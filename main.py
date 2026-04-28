import os
import sys

from dotenv import load_dotenv

from core.session.orchestrator import SessionOrchestrator
from interface.terminal_loop import TerminalLoop
from tools.factories import CommandFactory

load_dotenv()

MODEL_NAME = "qwen2.5-coder:14b"
DEFAULT_NUM_CTX = 16384


def _process_message(orchestrator: SessionOrchestrator, ui: TerminalLoop, prompt: str) -> None:
    persona = orchestrator.agent.role
    ui.begin_stream()
    for delta in orchestrator.stream_ask(prompt):
        ui.append_stream_delta(delta)

    msg = orchestrator._last_stream_message
    streamed = msg.get("content", "") or ""
    ui.update_tokens(orchestrator.last_token_count)

    if streamed:
        ui.finalize_stream_as_assistant(persona)
    else:
        ui.cancel_stream()

    if msg.get("tool_calls"):
        for call in msg["tool_calls"]:
            name = call["function"]["name"]
            args = call["function"]["arguments"]
            ui.add_system_message(f"→ tool: {name}")
            tool_output = orchestrator.call_tool(name, args)
            orchestrator.memory.add("tool", tool_output, name=name)

        ui.begin_stream()
        for delta in orchestrator.stream_ask("Proceed with the tool results."):
            ui.append_stream_delta(delta)
        final_msg = orchestrator._last_stream_message
        final_content = final_msg.get("content", "") or ""
        ui.update_tokens(orchestrator.last_token_count)

        if final_content:
            ui.finalize_stream_as_assistant(persona)
        else:
            ui.cancel_stream()
        orchestrator.memory.add("assistant", final_content)
    else:
        orchestrator.memory.add("assistant", streamed)


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
