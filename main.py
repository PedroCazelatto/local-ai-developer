import sys
from orchestrator.ui import UI
from orchestrator.engine import Engine
from orchestrator.docker_client import DockerClient
from orchestrator.tool_box import ToolBox

def main():
    if len(sys.argv) < 2:
        print("Uso: python main.py <project-name>")
        return

    project_name = sys.argv[1]
    project_path = f"./projects/{project_name}"

    ui = UI()
    docker = DockerClient()
    tools = ToolBox(project_path)
    engine = Engine()

    ui.display_message("system", f"Starting orchestrator for project: {project_name}")

    while True:
        user_input = input("> ")
        if user_input.lower() in ['quit', 'exit']: break

        ui.display_message("AI", "Awaiting tool loop implementation...")

if __name__ == "__main__":
    main()
