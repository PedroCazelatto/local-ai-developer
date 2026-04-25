from tools.base import BaseTool, ToolContext

DESCRIPTION = "Runs a shell command inside the project container."


class ExecuteCommandTool(BaseTool):
    parameters = {
        "type": "object",
        "properties": {
            "command": {"type": "string", "description": "The command to run"},
        },
        "required": ["command"],
    }

    def execute(self, ctx: ToolContext, /, **kwargs: object) -> str:
        command = kwargs.get("command")
        if not isinstance(command, str):
            return "Error: 'command' must be a string."
        result = ctx.docker.execute_command(command)
        return f"STDOUT: {result['stdout']}\nSTDERR: {result['stderr']}"
