import importlib
import pkgutil
import inspect
from orchestrator.tools import __path__ as tools_path

class ToolManager:
    def __init__(self, project_path):
        self.project_path = project_path
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
            except Exception as e:
                print(f"❌ Failed to load tool {name}: {str(e)}")

    def _generate_schema(self, func):
        sig = inspect.signature(func)
        doc = inspect.getdoc(func) or "No description provided."

        parameters = {
            "type": "object",
            "properties": {},
            "required": []
        }

        for name, param in sig.parameters.items():
            if name == "project_path":
                continue

            parameters["properties"][name] = {
                "type": "string",
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

    def execute_tool(self, tool_name, tool_args):
        if tool_name not in self.tools:
            return f"Error: Tool '{tool_name}' not found."

        func = self.tools[tool_name]

        tool_args['project_path'] = self.project_path

        try:
            return func(**tool_args)
        except Exception as e:
            return f"Execution error in {tool_name}: {str(e)}"
