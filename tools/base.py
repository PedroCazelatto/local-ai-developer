from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import TYPE_CHECKING

from core.container.client import DockerClient

if TYPE_CHECKING:
    from core.session.orchestrator import SessionOrchestrator


@dataclass
class ToolContext:
    project_path: str
    docker: DockerClient


class BaseTool(ABC):
    """Action callable by the model via tool-call."""

    parameters: dict[str, object] = {}

    @abstractmethod
    def execute(self, ctx: ToolContext, /, **kwargs: object) -> str:
        ...


@dataclass
class CommandResult:
    message: str | None = None
    exit: bool = False


class BaseCommand(ABC):
    """Action callable by the user via slash-command."""

    @abstractmethod
    def execute(self, args: list[str], orchestrator: "SessionOrchestrator") -> CommandResult:
        ...
