from abc import ABC, abstractmethod
from typing import List

class BaseAgent(ABC):
    @property
    @abstractmethod
    def persona(self) -> str:
        pass

    @property
    @abstractmethod
    def tools(self) -> List[str]:
        pass
