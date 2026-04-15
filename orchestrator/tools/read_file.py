import os
from .base import BaseTool

class ReadFileTool(BaseTool):
    def __init__(self, project_path: str):
        self.project_path = project_path

    @property
    def definition(self):
        return {
            "type": "function",
            "function": {
                "name": "read_file",
                "description": "Read content of one file",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string", "description": "Relative path to file"}
                    },
                    "required": ["path"]
                }
            }
        }

    def execute(self, path: str) -> str:
        full_path = os.path.join(self.project_path, path)
        try:
            with open(full_path, "r", encoding="utf-8") as f:
                return f.read()
        except Exception as e:
            return f"Error reading file: {str(e)}"
