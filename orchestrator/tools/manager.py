import importlib
import inspect
import os
from typing import List, Dict, Any
from .base import BaseTool

class ToolManager:
    def __init__(self, project_name: str):
        self.project_path = f"./projects/{project_name}"
        self.tools: Dict[str, BaseTool] = {}
        self._load_tools()

    def _load_tools(self) -> None:
        tools_dir = os.path.dirname(__file__)

        for filename in os.listdir(tools_dir):
            if filename.endswith(".py") and filename not in ["base.py", "manager.py", "__init__.py"]:
                module_name = f"orchestrator.tools.{filename[:-3]}"
                module = importlib.import_module(module_name)

                for name, obj in inspect.getmembers(module):
                    if inspect.isclass(obj) and issubclass(obj, BaseTool) and obj is not BaseTool:
                        instance = obj(self.project_path)
                        self.tools[instance.definition["function"]["name"]] = instance

    def get_all_definitions(self) -> List[Dict[str, Any]]:
        return [tool.definition for tool in self.tools.values()]

    def call_tool(self, name: str, args: Dict[str, Any]) -> str:
        tool = self.tools.get(name)
        if tool:
            return tool.execute(**args)
        return f"Erro: Tool '{name}' nao encontrada."
