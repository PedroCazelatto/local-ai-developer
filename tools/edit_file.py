from tools.base import BaseTool, ToolContext

DESCRIPTION = (
    "Replaces an exact string in an existing file. The 'old_string' must appear exactly once — "
    "if it is missing or matches multiple times, no change is made. Use this for small, targeted "
    "edits instead of rewriting the whole file."
)


class EditFileTool(BaseTool):
    parameters = {
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "Path relative to the project root.",
            },
            "old_string": {
                "type": "string",
                "description": "Exact text to find. Must match verbatim, including whitespace.",
            },
            "new_string": {
                "type": "string",
                "description": "Text that replaces old_string.",
            },
        },
        "required": ["path", "old_string", "new_string"],
    }

    def execute(self, ctx: ToolContext, /, **kwargs: object) -> str:
        path = kwargs.get("path")
        old_string = kwargs.get("old_string")
        new_string = kwargs.get("new_string")
        if not isinstance(path, str):
            return "Error: 'path' must be a string."
        if not isinstance(old_string, str) or not isinstance(new_string, str):
            return "Error: 'old_string' and 'new_string' must be strings."
        if old_string == new_string:
            return "Error: 'old_string' and 'new_string' are identical — nothing to do."
        try:
            resolved = ctx.resolve(path)
        except ValueError as e:
            return f"Error: {e}"
        try:
            with open(resolved, encoding="utf-8") as f:
                original = f.read()
        except FileNotFoundError:
            return f"Error: File '{path}' not found."
        except UnicodeDecodeError:
            return f"Error: File '{path}' is not valid UTF-8 text."
        except OSError as e:
            return f"Error reading '{path}': {e}"

        occurrences = original.count(old_string)
        if occurrences == 0:
            return f"Error: 'old_string' not found in '{path}'."
        if occurrences > 1:
            return f"Error: 'old_string' matches {occurrences} times in '{path}'. Provide more surrounding context to make it unique."

        updated = original.replace(old_string, new_string, 1)
        try:
            with open(resolved, "w", encoding="utf-8") as f:
                f.write(updated)
        except OSError as e:
            return f"Error writing '{path}': {e}"
        return f"Edited '{path}'."
