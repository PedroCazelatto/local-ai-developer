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
        user_input = input("\n> ").strip()
        if user_input.lower() in ['exit', 'quit']: break

        # Teste de Listagem
        if user_input == "ls":
            res = orc.tools['list_files'](project_path)
            ui.display_message("AI", f"Files:\n{res}")

        # Teste de Escrita: "write nome-do-arquivo conteudo"
        elif user_input.startswith("write "):
            try:
                # Divide o comando: write [0] arquivo.txt [1] conteudo [2:]
                parts = user_input.split(" ", 2)
                file_name = parts[1]
                content = parts[2] if len(parts) > 2 else "Test default content"

                # Chama a tool que criamos anteriormente
                res = orc.tools['write_file'](project_path, file_name, content)
                ui.display_message("AI", res)
            except Exception as e:
                ui.error(f"Invalid format. Usage: write file.txt Your content here")

        else:
            ui.display_message("system", "Available commands: ls, write [file] [content], quit")

if __name__ == "__main__":
    main()
