import re

from tools.base import BaseTool, ToolContext

DESCRIPTION = (
    "Runs a shell command inside the sandbox container. "
    "Runs in the active project's directory — paths are relative to the project root. "
    "Absolute references to other projects under /workspace/ and parent-directory "
    "traversals ('..') are rejected."
)

_TRAVERSAL_TOKEN = re.compile(r"(?:^|[\s'\"=:])\.\.(?:[/\\]|$|[\s'\"])")
_TRAVERSAL_IN_PATH = re.compile(r"[/\\]\.\.(?:[/\\]|$|[\s'\"])")


def _container_workdir(project_name: str) -> str:
    return f"/workspace/{project_name}"


def _detect_escape(command: str, active_project: str) -> str | None:
    """Return an error message if the command appears to leave the active project's directory."""
    boundary = r"(?:/|$|[\s;&|<>'\"])"
    cross_project = re.compile(
        rf"/workspace/(?!{re.escape(active_project)}{boundary})([A-Za-z0-9_.\-]+)"
    )
    match = cross_project.search(command)
    if match:
        return (
            f"references '/workspace/{match.group(1)}' which is outside the active "
            f"project '{active_project}'"
        )
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
        reason = _detect_escape(command, ctx.project_name)
        if reason is not None:
            return (
                f"Error: command rejected — {reason}. "
                f"Commands run from /workspace/{ctx.project_name}; "
                f"use paths relative to the project root."
            )
        result = ctx.docker.execute_command(command, workdir=_container_workdir(ctx.project_name))
        return f"STDOUT: {result['stdout']}\nSTDERR: {result['stderr']}"

    def audit_metadata(self, ctx: ToolContext, /, **kwargs: object) -> dict[str, object]:
        return {"workdir": _container_workdir(ctx.project_name)}
