import subprocess

class DockerClient:
    def __init__(self, container_name="developer"):
        self.container = container_name

    def execute(self, command):
        full_command = f"docker compose exec -T {self.container} {command}"
        try:
            result = subprocess.run(full_command, shell=True, capture_output=True, text=True)
            if result.returncode == 0:
                return result.stdout
            return f"Execution error: {result.stderr}"
        except Exception as e:
            return f"Failed to connect to docker: {str(e)}"
