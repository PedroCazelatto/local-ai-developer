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
    orchestrator = SessionOrchestrator(project_name, MODEL_NAME)
    commands = CommandFactory()
    ui = TerminalLoop()

    ui.display_welcome(project=project_name, model=MODEL_NAME, persona=orchestrator.agent.role)

    while True:
        try:
            ui.display_status(
                persona=orchestrator.agent.role,
                project=project_name,
                model=MODEL_NAME,
                memory_size=len(orchestrator.memory.history),
            )
            user_input = ui.get_input(orchestrator.agent.role)

            if user_input.strip().startswith("/"):
                result = commands.dispatch(user_input, orchestrator)
                if result.message:
                    ui.display_system_info(result.message)
                if result.exit:
                    break
                continue

            ui.stream_response(orchestrator.stream_ask(user_input), orchestrator.agent.role)
            response_msg = orchestrator._last_stream_message

            if response_msg.get("tool_calls"):
                for call in response_msg["tool_calls"]:
                    name = call["function"]["name"]
                    args = call["function"]["arguments"]
                    ui.display_system_info(f"Executing tool: {name}")
                    tool_output = orchestrator.call_tool(name, args)
                    orchestrator.memory.add("tool", tool_output, name=name)

                final_response = orchestrator.ask("Proceed with the tool results.")
                ui.display_response(final_response["content"], orchestrator.agent.role)
                orchestrator.memory.add("assistant", final_response["content"])
            else:
                orchestrator.memory.add("assistant", response_msg["content"])

        except KeyboardInterrupt:
            break


if __name__ == "__main__":
    main()
