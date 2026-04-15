import os
from typing import Dict, Any
from .base import BaseTool

class ListFilesTool(BaseTool):
    def __init__(self, project_path: str):
        self.project_path = project_path

    @property
    def definition(self) -> Dict[str, Any]:
        return {
            "type": "function",
            "function": {
                "name": "list_files",
                "description": "List all files on the project, recursively",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            }
        }

    def execute(self, **kwargs) -> str:
        try:
            files_list = []
            for root, _, files in os.walk(self.project_path):
                for file in files:
                    rel_path = os.path.relpath(os.path.join(root, file), self.project_path)
                    files_list.append(rel_path)
            return "\n".join(files_list) if files_list else "Empty project"
        except Exception as e:
            return f"Error listing files: {str(e)}"
