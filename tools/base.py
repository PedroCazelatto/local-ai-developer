from abc import ABC, abstractmethod
from typing import Dict, Any

class BaseTool(ABC):
    @property
    @abstractmethod
    def definition(self) -> Dict[str, Any]:
        pass

    @abstractmethod
    def execute(self, command: str) -> str:
        pass
