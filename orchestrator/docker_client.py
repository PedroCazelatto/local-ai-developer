import subprocess

class DockerClient:
    def __init__(self, container_name="developer"):
        self.container = container_name

    def execute(self, command):
        # O flag -T remove a necessidade de um terminal interativo (bom para scripts)
        full_command = f"docker compose exec -T {self.container} {command}"
        try:
            result = subprocess.run(full_command, shell=True, capture_output=True, text=True)
            if result.returncode == 0:
                return result.stdout
            return f"Erro na execução: {result.stderr}"
        except Exception as e:
            return f"Falha ao conectar com Docker: {str(e)}"
