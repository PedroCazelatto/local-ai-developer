import sys
from core.session.orchestrator import SessionOrchestrator
from interface.terminal_loop import TerminalLoop

MODEL_NAME = "qwen2.5-coder:14b"


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python main.py <project_name>")
        return

    project_name = sys.argv[1]
    orchestrator = SessionOrchestrator(project_name, MODEL_NAME)
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

            if ui.processor.is_command(user_input):
                parts = ui.processor.parse_command(user_input)
                cmd = parts[0]

                if cmd == "/exit":
                    break

                if cmd == "/swap":
                    if len(parts) < 2:
                        ui.display_error("Usage: /swap <persona>")
                        continue
                    try:
                        orchestrator.switch_agent(parts[1])
                        ui.display_system_info(f"Switched to: {orchestrator.agent.role}")
                    except ValueError as e:
                        ui.display_error(str(e))
                    continue

                if cmd == "/clear":
                    orchestrator.memory.clear()
                    ui.display_system_info(f"Cleared memory for: {orchestrator.agent.role}")
                    continue

                ui.display_error(f"Unknown command: {cmd}")
                continue

            ui.stream_response(orchestrator.stream_ask(user_input), orchestrator.agent.role)
            response_msg = orchestrator._last_stream_message

            if response_msg.get("tool_calls"):
                for call in response_msg["tool_calls"]:
                    name = call["function"]["name"]
                    args = call["function"]["arguments"]
                    ui.display_system_info(f"Executing tool: {name}")
                    result = orchestrator.tools.call_tool(name, args)
                    orchestrator.memory.add("tool", result, name=name)

                final_response = orchestrator.ask("Proceed with the tool results.")
                ui.display_response(final_response["content"], orchestrator.agent.role)
                orchestrator.memory.add("assistant", final_response["content"])
            else:
                orchestrator.memory.add("assistant", response_msg["content"])

        except KeyboardInterrupt:
            break


if __name__ == "__main__":
    main()
