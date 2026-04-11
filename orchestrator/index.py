import importlib
import pkgutil
from orchestrator.tools import __path__ as tools_path

class Orchestrator:
    def __init__(self):
        self.tools = {}
        self._load_tools()

    def _load_tools(self):
        # Itera sobre todos os arquivos na pasta tools
        for _, name, _ in pkgutil.iter_modules(tools_path):
            module = importlib.import_module(f"orchestrator.tools.{name}")
            # Assume que cada arquivo tem uma função com o mesmo nome do arquivo
            if hasattr(module, name):
                self.tools[name] = getattr(module, name)
                print(f"✅ Tool carregada: {name}")

    def get_tools_definition(self):
        # Aqui você retornaria a lista de JSONs para o Ollama
        # Por enquanto, retorna apenas os nomes para teste
        return list(self.tools.keys())
