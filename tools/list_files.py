import os
from tools.base import BaseTool
from typing import Dict, Any

class ListFilesTool(BaseTool):
    def __init__(self, project_path: str):
        self.project_path = project_path

    @property
    def definition(self) -> Dict[str, Any]:
        return {
            "type": "function",
            "function": {
                "name": "list_files",
                "description": "Lists all files in the current project directory.",
                "parameters": {"type": "object", "properties": {}, "required": []}
            }
        }

    def execute(self, **kwargs) -> str:
        try:
            if not os.path.exists(self.project_path):
                os.makedirs(self.project_path)
            files = os.listdir(self.project_path)
            return "\n".join(files) if files else "The project is empty."
        except Exception as e:
            return f"Error listing files: {str(e)}"
