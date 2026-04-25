import os
from fnmatch import fnmatch

from tools.base import BaseTool, ToolContext

DESCRIPTION = (
    "Searches for a literal substring across text files in the project directory. "
    "Returns matching file paths with line numbers and line text. "
    "Optionally filter by a filename glob (e.g., '*.py')."
)

_MAX_MATCHES = 200
_SKIP_DIRS = {".git", "__pycache__", "node_modules", ".venv", "venv", "dist", "build"}


class SearchInFilesTool(BaseTool):
    parameters = {
        "type": "object",
        "properties": {
            "pattern": {
                "type": "string",
                "description": "Literal substring to search for (case-sensitive).",
            },
            "glob": {
                "type": "string",
                "description": "Optional filename glob to filter files (e.g., '*.py'). Defaults to all files.",
            },
        },
        "required": ["pattern"],
    }

    def execute(self, ctx: ToolContext, /, **kwargs: object) -> str:
        pattern = kwargs.get("pattern")
        glob = kwargs.get("glob")
        if not isinstance(pattern, str) or not pattern:
            return "Error: 'pattern' must be a non-empty string."
        if glob is not None and not isinstance(glob, str):
            return "Error: 'glob' must be a string if provided."

        try:
            root = ctx.resolve(".")
        except ValueError as e:
            return f"Error: {e}"

        matches: list[str] = []
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in _SKIP_DIRS]
            for filename in filenames:
                if glob and not fnmatch(filename, glob):
                    continue
                full = os.path.join(dirpath, filename)
                relative = os.path.relpath(full, root).replace(os.sep, "/")
                try:
                    with open(full, encoding="utf-8") as f:
                        for lineno, line in enumerate(f, start=1):
                            if pattern in line:
                                matches.append(f"{relative}:{lineno}: {line.rstrip()}")
                                if len(matches) >= _MAX_MATCHES:
                                    matches.append(f"... truncated at {_MAX_MATCHES} matches.")
                                    return "\n".join(matches)
                except (UnicodeDecodeError, OSError):
                    continue

        if not matches:
            return f"No matches for '{pattern}'."
        return "\n".join(matches)
