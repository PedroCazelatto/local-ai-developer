import docker
from typing import Dict, Any

class DockerClient:
    def __init__(self, container_name: str) -> None:
        self.client = docker.from_env()
        self.container_name = container_name

    def execute_command(self, command: str, workdir: str | None = None) -> Dict[str, Any]:
        try:
            container = self.client.containers.get(self.container_name)
            exit_code, output = container.exec_run(
                cmd=f'sh -c "{command}"',
                workdir=workdir,
                demux=True
            )
            stdout, stderr = output
            return {
                "exit_code": exit_code,
                "stdout": stdout.decode("utf-8") if stdout else "",
                "stderr": stderr.decode("utf-8") if stderr else ""
            }
        except Exception as e:
            return {"exit_code": 1, "stdout": "", "stderr": str(e)}
