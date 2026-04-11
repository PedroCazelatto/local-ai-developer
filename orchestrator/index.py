import importlib
import pkgutil
from orchestrator.tools import __path__ as tools_path

class Orchestrator:
    def __init__(self):
        self.tools = {}
        self._load_tools()

    def _load_tools(self):
        for _, name, _ in pkgutil.iter_modules(tools_path):
            module = importlib.import_module(f"orchestrator.tools.{name}")

            if hasattr(module, name):
                self.tools[name] = getattr(module, name)
                print(f"✅ Loaded Tool: {name}")

    def get_tools_definition(self):
        return list(self.tools.keys())
