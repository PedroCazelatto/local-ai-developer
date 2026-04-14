import sys
import os
from dotenv import load_dotenv
from orchestrator.index import Orchestrator

load_dotenv()

def main():
    if len(sys.argv) < 2:
        print("Usage: .\run.ps1 start <project-name>")
        return

    project_name = sys.argv[1]
    project_path = os.path.abspath(f"./projects/{project_name}")

    if not os.path.exists(project_path):
        os.makedirs(project_path, exist_ok=True)

    orc = Orchestrator(project_name, project_path)
    orc.start()

    while True:
        user_input = input("\nYou > ").strip()

        if user_input.lower() in ['exit', 'quit']:
            orc.ui.display_message("system", "Shutting down...")
            break

        if not user_input:
            continue

        orc.process_command(user_input)

if __name__ == "__main__":
    main()
