import os
import sys

from dotenv import load_dotenv

from core.session.orchestrator import SessionOrchestrator
from interface.terminal_loop import TerminalLoop
from tools.factories import CommandFactory

load_dotenv()

MODEL_NAME = "qwen2.5-coder:14b"
DEFAULT_NUM_CTX = 16384


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python main.py <project_name>")
        return

    project_name = sys.argv[1]
    num_ctx = int(os.getenv("OLLAMA_NUM_CTX", str(DEFAULT_NUM_CTX)))
    orchestrator = SessionOrchestrator(project_name, MODEL_NAME, num_ctx=num_ctx)
    commands = CommandFactory()
    ui = TerminalLoop()

    ui.add_system_message(
        f"Local AI Developer  ·  project: {project_name}  ·  model: {MODEL_NAME}\n"
        f"Persona: {orchestrator.agent.role.replace('_', ' ').upper()}\n"
        f"Commands: /swap <role>  ·  /clear  ·  /exit"
    )

    while True:
        try:
            persona = orchestrator.agent.role
            status = ui.build_status(
                persona=persona,
                project=project_name,
                model=MODEL_NAME,
                tokens_used=orchestrator.last_token_count,
                num_ctx=num_ctx,
            )
            user_input = ui.get_input(persona, status)

            stripped = user_input.strip()
            if not stripped:
                continue

            if stripped.startswith("/"):
                cmd_name = stripped.lstrip("/").split(maxsplit=1)[0] if stripped.lstrip("/") else ""
                result = commands.dispatch(user_input, orchestrator)
                if cmd_name == "clear":
                    ui.clear_messages()
                if result.message:
                    ui.add_system_message(result.message)
                if result.exit:
                    break
                continue

            ui.add_user_message(user_input)
            ui.stream_response(orchestrator.stream_ask(user_input), persona, status)
            response_msg = orchestrator._last_stream_message
            streamed = response_msg.get("content", "") or ""

            if response_msg.get("tool_calls"):
                if streamed:
                    ui.add_assistant_message(streamed, persona)
                for call in response_msg["tool_calls"]:
                    name = call["function"]["name"]
                    args = call["function"]["arguments"]
                    ui.add_system_message(f"→ tool: {name}")
                    tool_output = orchestrator.call_tool(name, args)
                    orchestrator.memory.add("tool", tool_output, name=name)

                follow_up_status = ui.build_status(
                    persona=persona,
                    project=project_name,
                    model=MODEL_NAME,
                    tokens_used=orchestrator.last_token_count,
                    num_ctx=num_ctx,
                )
                ui.stream_response(
                    orchestrator.stream_ask("Proceed with the tool results."),
                    persona,
                    follow_up_status,
                )
                final_msg = orchestrator._last_stream_message
                final_content = final_msg.get("content", "") or ""
                if final_content:
                    ui.add_assistant_message(final_content, persona)
                orchestrator.memory.add("assistant", final_content)
            else:
                ui.add_assistant_message(streamed, persona)
                orchestrator.memory.add("assistant", streamed)

        except KeyboardInterrupt:
            break


if __name__ == "__main__":
    main()
