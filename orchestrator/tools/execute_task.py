from orchestrator.docker_client import DockerClient

def execute_task(command):
    client = DockerClient()
    return client.execute(command)
