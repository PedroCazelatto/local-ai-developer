import os

from tools.base import BaseTool, ToolContext

DESCRIPTION = (
    "Creates or overwrites a text file in the project directory with the given content. "
    "Parent directories are created automatically."
)


class WriteFileTool(BaseTool):
    parameters = {
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "Path relative to the project root.",
            },
            "content": {
                "type": "string",
                "description": "Full file contents to write. Overwrites any existing file at this path.",
            },
        },
        "required": ["path", "content"],
    }

    def execute(self, ctx: ToolContext, /, **kwargs: object) -> str:
        path = kwargs.get("path")
        content = kwargs.get("content")
        if not isinstance(path, str):
            return "Error: 'path' must be a string."
        if not isinstance(content, str):
            return "Error: 'content' must be a string."
        try:
            resolved = ctx.resolve(path)
        except ValueError as e:
            return f"Error: {e}"
        try:
            os.makedirs(os.path.dirname(resolved), exist_ok=True)
            with open(resolved, "w", encoding="utf-8") as f:
                f.write(content)
            return f"Wrote {len(content)} characters to '{path}'."
        except OSError as e:
            return f"Error writing '{path}': {e}"
