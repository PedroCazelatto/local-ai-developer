from tools.base import BaseTool, ToolContext

DESCRIPTION = "Reads a text file from the project directory and returns its contents."


class ReadFileTool(BaseTool):
    parameters = {
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "Path relative to the project root.",
            },
        },
        "required": ["path"],
    }

    def execute(self, ctx: ToolContext, /, **kwargs: object) -> str:
        path = kwargs.get("path")
        if not isinstance(path, str):
            return "Error: 'path' must be a string."
        try:
            resolved = ctx.resolve(path)
        except ValueError as e:
            return f"Error: {e}"
        try:
            with open(resolved, encoding="utf-8") as f:
                return f.read()
        except FileNotFoundError:
            return f"Error: File '{path}' not found."
        except UnicodeDecodeError:
            return f"Error: File '{path}' is not valid UTF-8 text."
        except OSError as e:
            return f"Error reading '{path}': {e}"
