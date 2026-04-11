import sys
from orchestrator.ui import UI
from orchestrator.engine import Engine
from orchestrator.docker_client import DockerClient
from orchestrator.tool_box import ToolBox

def main():
    if len(sys.argv) < 2:
        print("Uso: python main.py <nome-do-projeto>")
        return

    project_name = sys.argv[1]
    project_path = f"./projects/{project_name}"

    # Inicializa os componentes
    ui = UI()
    docker = DockerClient()
    tools = ToolBox(project_path)
    engine = Engine()

    ui.display_message("system", f"Iniciando orquestrador no projeto: {project_name}")

    # Loop de conversa básico (ainda sem o processamento automático de tools)
    while True:
        user_input = input("Você > ")
        if user_input.lower() in ['sair', 'exit']: break

        # Exemplo de fluxo:
        # 1. Enviar para a Engine
        # 2. Se a Engine pedir Tool, o Orchestrator executa via Docker ou ToolBox
        # 3. Mostrar resposta na UI
        ui.display_message("ia", "Aguardando implementação do loop de ferramentas...")

if __name__ == "__main__":
    main()
