import importlib
import pkgutil
import os
import inspect
from orchestrator.tools import __path__ as tools_path

class Orchestrator:
    def __init__(self):
        self.tools = {}
        self.tool_definitions = []
        self._load_tools()

    def _load_tools(self):
        for _, name, _ in pkgutil.iter_modules(tools_path):
            try:
                module = importlib.import_module(f"orchestrator.tools.{name}")
                func = getattr(module, name, None)
                if func:
                    self.tools[name] = func
                    self.tool_definitions.append(self._generate_schema(func))
                    print(f"✅ Tool loaded and indexed: {name}")
            except Exception as e:
                print(f"❌ Failed to load tool {name}: {str(e)}")

    def _generate_schema(self, func):
        """Generates an OpenAI-compatible JSON Schema from a Python function."""
        sig = inspect.signature(func)
        doc = inspect.getdoc(func) or "No description provided."

        parameters = {
            "type": "object",
            "properties": {},
            "required": []
        }

        for name, param in sig.parameters.items():
            # We skip 'project_path' because the orchestrator injects it automatically
            if name == "project_path":
                continue

            parameters["properties"][name] = {
                "type": "string", # Defaulting to string for simplicity
                "description": f"Parameter: {name}"
            }
            if param.default is inspect.Parameter.empty:
                parameters["required"].append(name)

        return {
            "type": "function",
            "function": {
                "name": func.__name__,
                "description": doc,
                "parameters": parameters
            }
        }

    def get_tools_definition(self):
        return self.tool_definitions
