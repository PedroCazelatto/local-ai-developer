import os
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import TYPE_CHECKING

from core.container.client import DockerClient

if TYPE_CHECKING:
    from core.session.orchestrator import SessionOrchestrator


@dataclass
class ToolContext:
    project_name: str
    project_path: str
    docker: DockerClient

    def resolve(self, relative: str) -> str:
        """Join `relative` onto the project root and reject any path that escapes it."""
        root = os.path.abspath(self.project_path)
        resolved = os.path.abspath(os.path.join(root, relative))
        if resolved != root and not resolved.startswith(root + os.sep):
            raise ValueError(f"Path '{relative}' escapes the project directory")
        return resolved


class BaseTool(ABC):
    """Action callable by the model via tool-call."""

    parameters: dict[str, object] = {}

    @abstractmethod
    def execute(self, ctx: ToolContext, /, **kwargs: object) -> str:
        ...

    def audit_metadata(self, ctx: ToolContext, /, **kwargs: object) -> dict[str, object]:
        """Tool-specific fields to record on the audit row (e.g. resolved workdir)."""
        return {}


@dataclass
class CommandResult:
    message: str | None = None
    exit: bool = False


class BaseCommand(ABC):
    """Action callable by the user via slash-command."""

    @abstractmethod
    def execute(self, args: list[str], orchestrator: "SessionOrchestrator") -> CommandResult:
        ...
