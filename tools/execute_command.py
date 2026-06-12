import re

from tools.base import BaseTool, ToolContext

# The sandbox mounts ONLY the active project at /workspace (see docker-compose.yml),
# so the project root IS /workspace and other projects / the host are not reachable
# regardless of how the command is written. This in-process check is a courtesy on
# top of that hard boundary: it gives the model a clean, recoverable "outside the
# project" error when it tries to climb out with '..', instead of letting it wander
# into the throwaway container OS and hit a confusing failure.
CONTAINER_WORKDIR = "/workspace"

DESCRIPTION = (
    "Runs a shell command inside the sandbox container. "
    "The working directory IS the project root (/workspace); paths are relative to it. "
    "Parent-directory traversals ('..') are rejected — there is nothing above the "
    "project, and other projects are not mounted."
)

_TRAVERSAL_TOKEN = re.compile(r"(?:^|[\s'\"=:])\.\.(?:[/\\]|$|[\s'\"])")
_TRAVERSAL_IN_PATH = re.compile(r"[/\\]\.\.(?:[/\\]|$|[\s'\"])")


def _detect_escape(command: str) -> str | None:
    """Return an error message if the command tries to climb above the project root."""
    if _TRAVERSAL_TOKEN.search(command) or _TRAVERSAL_IN_PATH.search(command):
        return "contains a '..' path component that could escape the project directory"
    return None


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
        reason = _detect_escape(command)
        if reason is not None:
            return (
                f"Error: command rejected — {reason}. "
                f"Commands run from the project root ({CONTAINER_WORKDIR}); "
                f"use paths relative to it."
            )
        result = ctx.docker.execute_command(command, workdir=CONTAINER_WORKDIR)
        return f"STDOUT: {result['stdout']}\nSTDERR: {result['stderr']}"

    def audit_metadata(self, ctx: ToolContext, /, **kwargs: object) -> dict[str, object]:
        return {"workdir": CONTAINER_WORKDIR, "project": ctx.project_name}
