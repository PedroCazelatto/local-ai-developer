import os

from tools.base import BaseTool, ToolContext

DESCRIPTION = "Lists all files in the current project directory."


class ListFilesTool(BaseTool):
    parameters = {"type": "object", "properties": {}, "required": []}

    def execute(self, ctx: ToolContext, /, **kwargs: object) -> str:
        try:
            if not os.path.exists(ctx.project_path):
                os.makedirs(ctx.project_path)
            files = os.listdir(ctx.project_path)
            return "\n".join(files) if files else "The project is empty."
        except OSError as e:
            return f"Error listing files: {e}"
