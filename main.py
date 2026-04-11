import sys
import os
from orchestrator.ui import UI
from orchestrator.index import Orchestrator

def main():
    if len(sys.argv) < 2:
        print("Usage: .\run.ps1 run <project-name>")
        return

    project_name = sys.argv[1]
    project_path = f"./projects/{project_name}"

    ui = UI()
    orc = Orchestrator()

    ui.display_message("system", f"Active project: {project_name}")
    ui.log_action("Dynamic tools", orc.get_tools_definition())

    while True:
        user_input = input("\n> ")
        if user_input.lower() in ['exit', 'quit']: break

        if user_input == "ls":
            if 'list_files' in orc.tools:
                res = orc.tools['list_files'](project_path)
                ui.display_message("AI", f"Files:\n{res}")
            else:
                ui.error("Tool 'list_files' not loaded.")

if __name__ == "__main__":
    main()
