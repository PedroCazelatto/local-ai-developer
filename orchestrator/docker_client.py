import docker
from .models import ExecutionResult

class DockerManager:
    def __init__(self, container_name: str = "meu_container_dev"):
        self.client = docker.from_env()
        self.container_name = container_name

    def execute(self, command: str) -> ExecutionResult:
        try:
            container = self.client.containers.get(self.container_name)

            exit_code, output = container.exec_run(
                cmd=f'sh -c "{command}"',
                demux=True
            )

            stdout, stderr = output

            return ExecutionResult(
                success=exit_code == 0,
                output=stdout.decode('utf-8') if stdout else "",
                error=stderr.decode('utf-8') if stderr else None,
                exit_code=exit_code
            )

        except Exception as e:
            return ExecutionResult(
                success=False,
                output="",
                error=str(e),
                exit_code=1
            )
