import sys
from core.session.orchestrator import SessionOrchestrator
from interface.terminal_loop import TerminalLoop

def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python main.py <project_name>")
        return

    project_name = sys.argv[1]
    orchestrator = SessionOrchestrator(project_name, "qwen2.5-coder:14b")
    ui = TerminalLoop()

    ui.display_system_info(f"System Ready. Project: {project_name}")

    while True:
        try:
            user_input = ui.get_input()

            if ui.processor.is_command(user_input):
                parts = ui.processor.parse_command(user_input)
                if parts[0] == "/exit": break
                if parts[0] == "/swap":
                    orchestrator.switch_agent(parts[1])
                    ui.display_system_info(f"Switched Agent to: {parts[1]}")
                continue

            response_msg = orchestrator.ask(user_input)

            if response_msg.get("tool_calls"):
                for call in response_msg["tool_calls"]:
                    name = call["function"]["name"]
                    args = call["function"]["arguments"]
                    ui.display_system_info(f"Executing tool: {name}")
                    result = orchestrator.tools.call_tool(name, args)
                    orchestrator.memory.add("tool", result, name=name)

                final_response = orchestrator.ask("Proceed with the tool results.")
                ui.renderer.display_chat("assistant", final_response["content"])
            else:
                ui.renderer.display_chat("assistant", response_msg["content"])
                orchestrator.memory.add("assistant", response_msg["content"])

        except KeyboardInterrupt:
            break

if __name__ == "__main__":
    main()
